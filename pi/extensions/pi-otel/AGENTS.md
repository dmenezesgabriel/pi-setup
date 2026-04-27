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

## Agent Responses

- Short, concise and precise
- Short sentences
- Well formatted in markdown to favor a redability
