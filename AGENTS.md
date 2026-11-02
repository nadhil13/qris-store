<!-- antislop:start -->
## antislop
For UI, copy, people, mobile layout, or code comments work, read these installed skill files directly (use these paths even if a same-named global skill exists):
- Core filter, always on: `antislop`: `.agents/skills/antislop/SKILL.md`
- UI / visual: `antislop-ui`: `.agents/skills/antislop-ui/SKILL.md`
- Copy & text: `antislop-copywriting`: `.agents/skills/antislop-copywriting/SKILL.md`
- People: `antislop-human`: `.agents/skills/antislop-human/SKILL.md`
- Mobile / responsive: `antislop-layoutmobile`: `.agents/skills/antislop-layoutmobile/SKILL.md`
- Code comments: `antislop-code`: `.agents/skills/antislop-code/SKILL.md`
Before starting, follow the core's "Two Usage Modes" section in strict order: explicit session instruction first, then global preference, then ask. A session instruction always wins. For a resolved mode, say `antislop active: <mode> (session override).` or `antislop active: <mode> (global preference).` once before presenting findings or making edits, using the actual mode and source. Acknowledging the user's request without naming the source does not replace this notice.
Only an explicit choice of antislop during or after selects a session mode. A request to review, audit, or avoid file edits does not select a mode; read the global preference in that case. Another skill's mode does not select antislop's mode.
If the mode is unresolved, ask during/after and end the response; wait for the answer before any UI review, planning, or concept. For read-only tasks, put the active-mode notice only at the start of the final answer, never in progress messages. For editing tasks, announce before the first edit and omit it from the final answer.
To update antislop later: `npx antislop-ai --update`, or run `npx antislop-ai` and pick Overwrite them.
<!-- antislop:end -->

## Installed Skills & Engineering Frameworks

This workspace is equipped with the following skills installed in `.agents/skills/`:

### 1. Superpowers (`obra/superpowers`)
Software engineering and development methodology skills:
- `using-superpowers`: `.agents/skills/using-superpowers/SKILL.md` (Entrypoint)
- `brainstorming`: `.agents/skills/brainstorming/SKILL.md` (Explore requirements & architectural designs)
- `writing-plans`: `.agents/skills/writing-plans/SKILL.md` (Structured implementation plans)
- `executing-plans`: `.agents/skills/executing-plans/SKILL.md` (Batch execution of plans)
- `subagent-driven-development`: `.agents/skills/subagent-driven-development/SKILL.md` (Parallel subagent workflows)
- `test-driven-development`: `.agents/skills/test-driven-development/SKILL.md` (TDD red-green-refactor)
- `systematic-debugging`: `.agents/skills/systematic-debugging/SKILL.md` (Root cause analysis & hypotheses)
- `requesting-code-review`: `.agents/skills/requesting-code-review/SKILL.md`
- `receiving-code-review`: `.agents/skills/receiving-code-review/SKILL.md`
- `verification-before-completion`: `.agents/skills/verification-before-completion/SKILL.md`
- `finishing-a-development-branch`: `.agents/skills/finishing-a-development-branch/SKILL.md`

### 2. Scroll Craft (`nateherkai/scroll-craft`)
Scroll-driven interactive web experiences & non-template design grammar:
- `scroll-craft`: `.agents/skills/scroll-craft/SKILL.md` (Scroll timelines, cinematic pacing, layout verification)

### 3. Huashu Design (`alchaincyf/huashu-design`)
Designer studio workflow & multi-direction generation:
- `huashu-design`: `.agents/skills/huashu-design/SKILL.md` (Prototyping, 3 candidate directions, visual styling, presentation slides)

### 4. Impeccable (`pbakaus/impeccable`)
Visual hierarchy, craft heuristics, and anti-pattern enforcement:
- `impeccable`: `.agents/skills/impeccable/SKILL.md` (Design critique, polish, audit, bolder/quieter, design system alignment)

### 5. UI UX Pro Max (`nextlevelbuilder/ui-ux-pro-max-skill`)
Comprehensive design intelligence, typography pairings, color palettes, and accessibility checklists:
- `ui-ux-pro-max`: `.agents/skills/ui-ux-pro-max/SKILL.md`
- `design-system`: `.agents/skills/design-system/SKILL.md`
- `brand`: `.agents/skills/brand/SKILL.md`
- `ui-styling`: `.agents/skills/ui-styling/SKILL.md`
- `banner-design`: `.agents/skills/banner-design/SKILL.md`
- `slides`: `.agents/skills/slides/SKILL.md`
