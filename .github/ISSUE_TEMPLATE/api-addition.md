---
name: Component API Addition
about: Propose adding a new method, event, or prop to DeepgramVoiceInteraction
title: '[API] Add [method/prop name]'
labels: 'api-change'
---

## Proposed Addition

**Type**: Method / Event / Prop / Callback  
**Name**: `methodName`  
**Interface**: `DeepgramVoiceInteractionHandle` / `DeepgramVoiceInteractionProps`

## Rationale

Why is this addition needed? What problem does it solve?

## Current Workarounds

How do developers currently achieve this functionality?

## Proposed API

\`\`\`typescript
// Method signature or prop type
methodName: (param: Type) => ReturnType;
\`\`\`

## Usage Example

\`\`\`typescript
// How would developers use this?
const ref = useRef<DeepgramVoiceInteractionHandle>(null);
ref.current?.methodName(param);
\`\`\`

## Impact Assessment

- [ ] Breaking change
- [ ] Non-breaking addition
- [ ] Requires test-app changes
- [ ] Requires documentation updates
- [ ] Requires migration guide

## Alternatives Considered

What other approaches were considered and why were they rejected?

## Testing Plan

How will this addition be tested?

