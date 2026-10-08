# Validation and releases

Ready pull requests from this repository and every main commit run lint,
TypeScript checks, all Bun tests, the build and a built-plugin smoke on free
standard public GitHub runners. Installs use the lockfile and Bun 1.3.2.
Validation has read-only checkout credentials and a ten-minute limit; it does
not upload artifacts or caches, deploy, or publish packages.

Candidate source never executes under `pull_request_target`. The separate
pull request title check only reads metadata.

Release and publishing jobs require an administrator to explicitly set
`RELEASE_AUTOMATION_APPROVED=true` after authorizing those actions. The variable
is unset on this fork, so merging validation changes does not create releases
or publish packages. CI enrollment does not authorize enabling that variable.
