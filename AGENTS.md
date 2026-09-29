<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep MazeX maze generation and pathfinding in `src/features/mazex/game.ts`, separate from rendering, so solvability and AI remain testable.
- Render the real-time MazeX playfield on Canvas while React owns menus and HUD, so frame updates stay smooth on phones.
