# AI Agent Instructions

## Source Code Reference

Source code for dependencies is cached at `~/.opensrc/`.

Use `opensrc path <package>` to find the cached source path or read the dependency source code:

```bash
# Example usage:
# GSAP Core
cat $(opensrc path gsap)/src/gsap-core.js

# ScrollTrigger and other plugins are part of the main gsap package:
cat $(opensrc path gsap)/src/ScrollTrigger.js
rg "ScrollTrigger" $(opensrc path gsap)/src/

# GSAP React wrapper
cat $(opensrc path @gsap/react)/src/index.js
```


