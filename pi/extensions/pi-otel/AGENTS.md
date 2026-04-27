# Project Guidelines

This is a Pi coding agent extension, you can know more by reading Pi internal documentation, the purpose of this project is to integrate Pi coding agent with open telemetry so it can send it's traces to tools like `Grafana/Tempo` and `MLflow`.

## Coding style

- Constants, variables, classes and function names must be semantic enough to understand the program on a granular level so comments and in code documentation is dispensable.
- Software design principles like S.O.L.I.D must be respected, even if not working with classes and objects **Single Responsability Principle** and **Open Closed Principle** are a must.
- Cyclomatic complexity must be low
- External dependencies should be minimal but still do not reivent the whell, use reliable, secure and well maintained packages widely used as an industry standard.
- Redable, extendable and maintainable code
- Simple and flat code base as long as possible

## Stack

- Javascript/Typescript
- Vite as bundler
- Vitest as test runner
- StrykerJs for mutation tests
- Eslit for linting
- Prettier for formatting

## Testing

- Use Test Driven Development
- Use Triple A Framework
- Cover each scenario for success, failure and edge cases
- Assure a high test coverage
- Make sure that unit tests tests a single behavior, use mocks and spies accordingly 

## Way of work

- Always start with planning
- Always do a deep research in latest documentation of packages used over the internet with your available tools
- Always create a temporary TODO list markdown file with all tasks that should be implemented, on after each task is done mark as complete `- [x] Task` the proceed to the next one untill you finish them all
- You have tmux at your disposal for running background commands interactively, always use it to run scripts, tests or any other blocking commands, stablish a periodic check, because you may need to send keys to exit some process instead of waiting for a long timeout and be hanging

## Agent Responses

- Short, concise and precise
- Short sentences
- Well formatted in markdown to favor a redability
