# Agentops Typescript Package

---

`npm i agentops-demo`

## Core Concepts

- **Session**
- **Events** (LLM, Tool, Action, Error)

## Package Export Structure

```typescript
// AgentOps instance similar to the Python version, containing the same methods.
import agentops from 'agentops';
```

## Tracking Libraries/Tools

```typescript
import { OpenAi } from "openai";
import agentops from "agentops";

// First method:
const oai_instance = new OpenAi({ ... });

const session = agentops.init({
    patcher: [oai_instance] // Detects the schema and binds the wrapper to methods.
});

// Second method:
const oai = agentops.wrap.fromOpenAi(oai_instance);
```

The second method is cleaner.

### How to Detect Libraries?

Based on the `llm/tracker.py` in the Python package, there is a list of packages with specific versions and their properties. In Node.js, we can access package versions by reading the project's `package.json`.

However, it’s unclear if versioning is necessary for better functionality. We can still maintain a list of properties and automatically inject our tracker into them.

If the user uses the `agentops.wrap.fromOpenAi` method, it will be easier. However, if they use the patcher array (first method), we need to detect the libraries by their constructor `.name` to identify the class they are instantiated from. Then, we can proceed with injecting our trackers.

---

## Events Exporter

After reviewing the `SessionExporter` class in Python, we can implement a similar OpenTelemetry structure in JavaScript.

---

## Core Package Classes

1. **Client**: A global instance of the `Client` class to manage sessions globally.
2. **Session**: Contains all session-related functionality.
3. **Config**: Similar to `Configuration` in Python, it holds all necessary configurations and will be injected wherever needed.

---

## Decorators / Trackers

Typescript does not allow decorators for standalone functions. Instead, we have two options:

1. **Wrapper Function**

```typescript
function myAgentFn() {}
const myAgent = agentops.wrapFn(myAgentFn);
// then use myAgent instead of myAgentFn
```

2. **Support Decorators for Classes and Their Methods**

```typescript
class MyAgents {
  @trackAgent('search-agent')
  searchAgent() {
    // Method implementation
  }
}

// OR

@trackEvents('web-agent')
class WebAgent {
  search() {
    // Method implementation
  }
}
```
