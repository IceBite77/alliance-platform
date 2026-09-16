# UI v2 architecture

UI v2 is a clean application layer built on the existing Alliance Platform
database, authentication and permission system.

## Non-negotiable rules

1. `shell.ts` is the only owner of the document, header, navigation, page
   container, branding tokens and footer.
2. A page supplies page metadata and content only. It must not create or
   restyle the shared shell.
3. `context.ts` is the single boundary between the shell and the existing
   account, alliance, rank, branding and permission data.
4. UI v2 responses are returned directly by `handler.ts`. They must never pass
   through a legacy HTML rewrite, polish or compatibility adapter.
5. Existing pages move into UI v2 one route at a time only after the shell is
   approved on desktop, tablet and mobile.

The initial authenticated preview route is `/ui-v2`.
