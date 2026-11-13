export const INVENTORY_SCRIPT = String.raw`
local RECLAIM_LIMIT = 128
local RECORD_LIMIT = 5000
local function fail(code, status) return {ok=false, code=code, status=status or 409} end
local function decode(raw)
  local ok, value = pcall(cjson.decode, raw)
  if not ok or type(value) ~= 'table' then error('Invalid stored JSON') end
  return value
end
local fields = {
  state={stock='map',holds='holds',orders='records'},
  record={order='order',quantities='map'},
  hold={quantities='map'},
  order={items='items',timeline='timeline'},
  response={order='order',orders='orderList',stock='snapshot'},
  snapshot={products='map'}
}
local elements = {records='record',holds='hold',orderList='order'}
local arrays = {items=true,timeline=true,orderList=true}
local function encode(value, context)
  if type(value) ~= 'table' then return cjson.encode(value) end
  local parts = {}
  if arrays[context] or (context==nil and #value>0) then
    for _, v in ipairs(value) do table.insert(parts, encode(v,elements[context])) end
    return '[' .. table.concat(parts, ',') .. ']'
  end
  for k,v in pairs(value) do
    local child=elements[context] or (fields[context] and fields[context][k])
    table.insert(parts,cjson.encode(tostring(k)) .. ':' .. encode(v,child))
  end
  return '{' .. table.concat(parts, ',') .. '}'
end
local function integer(n, max) return type(n)=='number' and n>=0 and n<=max and n==math.floor(n) end
local function run()
  local input=decode(ARGV[1])
  local time=redis.call('TIME')
  local now=tonumber(time[1])*1000+math.floor(tonumber(time[2])/1000)
  local settingsRaw=redis.call('GET',KEYS[2])
  local settings=settingsRaw and decode(settingsRaw) or {}
  local products=settings.products
  if products==nil or products==cjson.null then products=input.seedProducts end
  if type(products)~='table' or #products>2000 then return fail('CATALOG_UNAVAILABLE',503) end
  local catalog={}
  for _,p in ipairs(products) do
    if type(p)~='table' or type(p.id)~='string' or catalog[p.id] or type(p.name)~='string' or not integer(p.price,1000000000) then return fail('CATALOG_INVALID',503) end
    if p.stock~=nil and p.stock~=cjson.null and not integer(p.stock,1000000000) then return fail('CATALOG_INVALID',503) end
    if p.variants~=nil and type(p.variants)~='table' then return fail('CATALOG_INVALID',503) end
    local labels={}
    for _,v in ipairs(p.variants or {}) do
      if type(v)~='table' or type(v.label)~='string' or labels[v.label] or type(v.delta)~='number' or v.delta~=math.floor(v.delta) or math.abs(v.delta)>1000000000 or p.price+v.delta<0 then return fail('CATALOG_INVALID',503) end
      labels[v.label]=true
    end
    catalog[p.id]=p
  end
  local raw=redis.call('GET',KEYS[1])
  local state
  if raw then state=decode(raw) else
    state={version=1,revision=0,stock={},holds={},orders={},sequence=0}
    for id,p in pairs(catalog) do state.stock[id]=p.stock==nil and cjson.null or p.stock end
  end
  if state.version~=1 or not integer(state.revision,9007199254740000) or not integer(state.sequence,9007199254740000) or type(state.stock)~='table' or type(state.holds)~='table' or type(state.orders)~='table' then error('Invalid inventory state') end
  local count=0
  for id,record in pairs(state.orders) do
    count=count+1
    if count>RECORD_LIMIT or type(record)~='table' or type(record.order)~='table' or type(record.order.items)~='table' or type(record.order.timeline)~='table' or type(record.order.payment)~='table' or type(record.quantities)~='table' or not integer(record.sequence,state.sequence) or type(record.capabilityHash)~='string' or type(record.fingerprint)~='string' then error('Invalid order state') end
    local statuses={awaiting_payment=true,paid=true,processing=true,ready=true,completed=true,cancelled=true,expired=true}
    if not statuses[record.order.status] then error('Invalid order status') end
    for pid,qty in pairs(record.quantities) do if not integer(qty,99) or qty<1 or state.stock[pid]==nil then error('Invalid order quantities') end end
  end
  for id,stock in pairs(state.stock) do if stock~=cjson.null and not integer(stock,1000000000) then error('Invalid stock state') end end
  local expired={}
  for id,hold in pairs(state.holds) do
    if type(hold)~='table' or not integer(hold.expiresAt,9007199254740991) or type(hold.quantities)~='table' or not state.orders[id] or state.orders[id].order.status~='awaiting_payment' then error('Invalid hold state') end
    for pid,qty in pairs(hold.quantities) do if not integer(qty,99) or qty<1 or state.stock[pid]==nil then error('Invalid hold quantities') end end
    if hold.expiresAt<=now then table.insert(expired,id) end
  end
  table.sort(expired,function(a,b)
    if a==b then return false end
    if a==input.id then return true end
    if b==input.id then return false end
    return state.holds[a].expiresAt < state.holds[b].expiresAt
  end)
  local function release(quantities)
    for id,qty in pairs(quantities) do
      if state.stock[id]~=cjson.null then
        if state.stock[id]+qty>1000000000 then error('Stock overflow') end
        state.stock[id]=state.stock[id]+qty
      end
    end
  end
  local function transition(order,status,note)
    local updatedAt=math.max(now,(tonumber(order.updatedAt) or 0)+1)
    order.status=status; order.updatedAt=updatedAt
    table.insert(order.timeline,{status=status,at=updatedAt,by='server',note=note or ''})
  end
  for i=1,math.min(#expired,RECLAIM_LIMIT) do
    local id=expired[i]
    release(state.holds[id].quantities)
    state.holds[id]=nil
    transition(state.orders[id].order,'expired')
    state.revision=state.revision+1
  end
  local function snapshot() return {revision=state.revision,products=state.stock,serverTime=now} end
  local function success(order) return {ok=true,order=order,stock=snapshot()} end
  local function execute()
    if input.action=='stock' then return {ok=true,stock=snapshot(),reclaimPending=#expired>RECLAIM_LIMIT} end
    if input.action=='list' then
      local records={}
      for _,record in pairs(state.orders) do table.insert(records,record) end
      table.sort(records,function(a,b) return a.sequence>b.sequence end)
      local orders={}
      for i=1,math.min(#records,200) do table.insert(orders,records[i].order) end
      return {ok=true,orders=orders,stock=snapshot(),reclaimPending=#expired>RECLAIM_LIMIT}
    end
    local record=state.orders[input.id]
    if input.action=='order' then
      if not record or record.capabilityHash~=input.capabilityHash then return fail('ORDER_NOT_FOUND',404) end
      return success(record.order)
    end
    if input.action=='reserve' and record then
      if record.capabilityHash~=input.capabilityHash then return fail('IDEMPOTENCY_CONFLICT') end
      if record.fingerprint~=input.fingerprint then return fail('IDEMPOTENCY_CONFLICT') end
      return success(record.order)
    end
    if #expired>RECLAIM_LIMIT then return fail('RECLAIM_REQUIRED',503) end
    if input.action=='reserve' then
      if count>=RECORD_LIMIT then return fail('ORDER_CAPACITY_REACHED',503) end
      if type(settings.store)=='table' and settings.store.isOpen==false then return fail('STORE_CLOSED') end
      local items,quantities={},{}
      local subtotal,itemCount,digitalOnly=0,0,true
      local seen={}
      for _,line in ipairs(input.items) do
        local p=catalog[line.productId]
        if not p or p.isAvailable==false then return fail('PRODUCT_UNAVAILABLE') end
        if state.stock[p.id]==nil then return fail('STOCK_NOT_INITIALIZED') end
        local label=line.variant
        local delta=0
        if #(p.variants or {})>0 then
          if label=='' then label=p.variants[1].label end
          local found=false
          for _,v in ipairs(p.variants) do if v.label==label then delta=v.delta; found=true end end
          if not found then return fail('INVALID_VARIANT',400) end
        elseif label~='' then return fail('INVALID_VARIANT',400) end
        local key=p.id .. '::' .. label
        if seen[key] then return fail('DUPLICATE_LINE',400) end
        seen[key]=true
        local price=p.price+delta
        if not integer(price,1000000000) then return fail('CATALOG_INVALID',503) end
        quantities[p.id]=(quantities[p.id] or 0)+line.qty
        if quantities[p.id]>99 or (state.stock[p.id]~=cjson.null and quantities[p.id]>state.stock[p.id]) then return fail('OUT_OF_STOCK') end
        itemCount=itemCount+line.qty; subtotal=subtotal+price*line.qty
        if p.category~='digital' then digitalOnly=false end
        table.insert(items,{productId=p.id,name=p.name,image=p.image or '',variant=label,qty=line.qty,unitPrice=price,note=line.note})
      end
      local shipping
      if digitalOnly then shipping={id='digital',name='Dikirim digital via WhatsApp',price=0,eta='Setelah pembayaran'} else
        for _,candidate in ipairs(input.commerce.shipping) do if candidate.id==input.shippingId then shipping=candidate end end
        if not shipping then return fail('INVALID_SHIPPING',400) end
        if shipping.id~='pickup' and #input.customer.address==0 then return fail('ADDRESS_REQUIRED',400) end
      end
      local discount=0
      if input.voucherCode~='' then
        local voucher
        for _,v in ipairs(input.commerce.vouchers) do if v.active~=false and v.code==input.voucherCode then voucher=v end end
        if not voucher then return fail('INVALID_VOUCHER',400) end
        discount=math.floor(subtotal*voucher.percent/100+0.5)
      end
      local packaging=(not digitalOnly and subtotal>0) and input.commerce.packagingFee or 0
      local shippingCost=subtotal>0 and shipping.price or 0
      local baseTotal=math.max(0,subtotal-discount+shippingCost+packaging)
      local uniqueFlag=settings.uniqueCodeEnabled==true
      if type(settings.qris)=='table' and settings.qris.uniqueCodeEnabled~=nil then uniqueFlag=settings.qris.uniqueCodeEnabled==true end
      local uniqueCode=0
      if input.paymentMethod=='qris' and uniqueFlag and baseTotal>0 then
        local usedTotals={}
        for id,entry in pairs(state.orders) do
          if entry.order.status=='awaiting_payment' and state.holds[id] and entry.order.totals then
            usedTotals[entry.order.totals.total]=true
          end
        end
        local start=(state.sequence*137)%899
        for offset=0,898 do
          local candidate=101+((start+offset)%899)
          if not usedTotals[baseTotal+candidate] then uniqueCode=candidate; break end
        end
      end
      local totals={itemCount=itemCount,subtotal=subtotal,discount=discount,shippingCost=shippingCost,packaging=packaging,total=baseTotal+uniqueCode,digitalOnly=digitalOnly}
      if uniqueCode>0 then totals.uniqueCode=uniqueCode end
      local payload=''
      if type(settings.qris)=='table' then
        if type(settings.qris.payload)=='string' then payload=settings.qris.payload end
      elseif type(settings.payload)=='string' then
        payload=settings.payload
      end
      local order={id=input.id,invoice='AN' .. tostring(now) .. '-' .. tostring(state.sequence+1),createdAt=now,updatedAt=now,expiresAt=now+600000,status='awaiting_payment',items=items,totals=totals,voucherCode=input.voucherCode,customer=input.customer,shipping=shipping,payment={method=input.paymentMethod,payload=payload,paidAt=cjson.null,confirmedBy=cjson.null},timeline={{status='awaiting_payment',at=now,by='pelanggan'}}}
      for id,qty in pairs(quantities) do if state.stock[id]~=cjson.null then state.stock[id]=state.stock[id]-qty end end
      state.sequence=state.sequence+1
      state.orders[input.id]={order=order,capabilityHash=input.capabilityHash,fingerprint=input.fingerprint,sequence=state.sequence,quantities=quantities}
      state.holds[input.id]={expiresAt=order.expiresAt,quantities=quantities}
      state.revision=state.revision+1
      return success(order)
    end
    if input.action=='adjust' then
      if input.expectedRevision~=state.revision then return fail('REVISION_CONFLICT') end
      if not catalog[input.productId] then return fail('PRODUCT_NOT_FOUND',404) end
      local previous=state.stock[input.productId]
      local liability=0
      for _,entry in pairs(state.orders) do
        local status=entry.order.status
        if status~='completed' and status~='cancelled' and status~='expired' then
          local qty=entry.quantities[input.productId]
          if qty then
            if ((previous==cjson.null)~=(input.stock==cjson.null)) then return fail('ACTIVE_ORDER_MODE_CONFLICT') end
            liability=liability+qty
          end
        end
      end
      if input.stock~=cjson.null and input.stock+liability>1000000000 then return fail('STOCK_LIMIT_EXCEEDED',400) end
      state.stock[input.productId]=input.stock
      state.revision=state.revision+1
      return {ok=true,stock=snapshot()}
    end
    if input.action=='webhook_confirm' then
      local targetId,order
      local invoice=type(input.invoice)=='string' and input.invoice or ''
      local reqId=type(input.id)=='string' and input.id or ''
      local reqAmount=tonumber(input.amount or 0) or 0
      if reqId~='' then
        local rec=state.orders[reqId]
        if not rec then return fail('ORDER_NOT_FOUND',404) end
        targetId=reqId; order=rec.order
      elseif invoice~='' then
        for id,entry in pairs(state.orders) do
          if entry.order.invoice==invoice then targetId=id; order=entry.order; break end
        end
        if not order then return fail('ORDER_NOT_FOUND',404) end
      elseif reqAmount>0 then
        local matches={}
        for id,entry in pairs(state.orders) do
          local o=entry.order
          if o.status=='awaiting_payment' and state.holds[id] and now<o.expiresAt and o.totals and o.totals.total==reqAmount then
            table.insert(matches,id)
          end
        end
        if #matches>1 then return fail('AMBIGUOUS_AMOUNT') end
        if #matches==1 then
          targetId=matches[1]; order=state.orders[targetId].order
        else
          local ref=type(input.reference)=='string' and input.reference or ''
          if ref~='' then
            for _,entry in pairs(state.orders) do
              local o=entry.order
              if o.status=='paid' and o.payment and o.payment.reference==ref and o.totals and o.totals.total==reqAmount then
                return success(o)
              end
            end
          end
          return fail('ORDER_NOT_FOUND',404)
        end
      else
        return fail('INVALID_REQUEST',400)
      end
      if reqAmount>0 and order.totals and order.totals.total~=reqAmount then return fail('AMOUNT_MISMATCH') end
      if order.status=='paid' then return success(order) end
      if order.status~='awaiting_payment' or not state.holds[targetId] or now>=order.expiresAt then return fail('INVALID_TRANSITION') end
      transition(order,'paid',type(input.note)=='string' and input.note or '')
      order.payment.paidAt=now
      order.payment.confirmedBy=(type(input.confirmedBy)=='string' and input.confirmedBy~='') and input.confirmedBy or 'gopay_merchant_webhook'
      if type(input.reference)=='string' and input.reference~='' then order.payment.reference=input.reference end
      state.holds[targetId]=nil
      state.revision=state.revision+1
      return success(order)
    end
    if not record then return fail('ORDER_NOT_FOUND',404) end
    local order=record.order
    if input.action=='confirm' then
      if order.status=='paid' then return success(order) end
      if order.status~='awaiting_payment' or not state.holds[input.id] or now>=order.expiresAt then return fail('INVALID_TRANSITION') end
      transition(order,'paid'); order.payment.paidAt=now; order.payment.confirmedBy='admin'; order.payment.reference=input.reference
      state.holds[input.id]=nil
    elseif input.action=='cancel' then
      if order.status=='cancelled' then return success(order) end
      if order.status=='completed' or order.status=='expired' then return fail('INVALID_TRANSITION') end
      release(record.quantities); state.holds[input.id]=nil; transition(order,'cancelled',input.note)
    elseif input.action=='advance' then
      local nextStatus={paid='processing',processing='ready',ready='completed'}
      local target=nextStatus[input.expectedStatus]
      if target and order.status==target then return success(order) end
      if order.status~=input.expectedStatus or not target then return fail('INVALID_TRANSITION') end
      transition(order,target)
    else return fail('INVALID_ACTION',400) end
    state.revision=state.revision+1
    return success(order)
  end
  local result=execute()
  local encodedState=encode(state,'state')
  local encodedResult=encode(result,'response')
  redis.call('SET',KEYS[1],encodedState)
  return encodedResult
end
local ok,result=pcall(run)
if not ok then return cjson.encode(fail('INVENTORY_STATE_INVALID',503)) end
if type(result)=='table' then return encode(result,'response') end
return result
`;
