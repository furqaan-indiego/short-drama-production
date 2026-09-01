# 16:9 landscape-production contract

## 1. Default project specification

New projects default to:

```json
{
  "aspectRatio": "16:9",
  "orientation": "landscape",
  "deliveryWidth": 1920,
  "deliveryHeight": 1080,
  "fps": 24,
  "compositionProfile": "landscape-ensemble",
  "safeArea": { "action": 0.95, "title": 0.90 },
  "generationResolution": "768P"
}
```

`generationResolution` is the H3 generation tier, while `deliveryWidth/Height` is the post-production delivery specification; do not confuse them. Pilots default to 768P to control cost. After the user approves clarity and cost, change to 2K. Assemble final rough cuts at 1920×1080.

## 2. Landscape directing grammar

The advantage of 16:9 is relationships, space, and blocking. Do not simply expand a vertical-video treatment sideways:

- Place conflicting parties in the left and right thirds; use distance, occlusion, and negative space to show power.
- Two-shots, over-the-shoulder shots, and foreground/background relationships can carry narrative; reserve close-ups for realization, evidence, and reaction.
- Preserve screen direction for lateral character movement. Specify left/right relationships for entrances, exits, eyelines, and prop handoffs.
- In ensemble scenes, establish spatial hierarchy first, then shift power through medium and close shots. Do not line everyone up for a horizontal group portrait.
- Horizontal camera movement must have a visible trigger, path, and stopping point. A lateral move is not "cinematic" by itself; it represents a relationship change.
- Keep key text, evidence, and faces away from the left and right edges. Retain safe area for player cropping and platform controls.
- When a phone, computer, or document carries plot-critical information, do not leave the content on a tiny screen merely because landscape has more space. After an environmental shot, use an insert occupying at least half the frame, full-screen subjective content, or a post composite, then explicitly cut back to character reaction.

At the directing stage, explicitly use:

```bash
node <short-drama-director>/scripts/director-kit.mjs seed <script.json> --aspect 16:9
```

If the director package is still 9:16, the bridge must fail. Do not quietly change it to landscape during technical storyboarding.

## 3. Storyboard images and H3

- Every keyframe and storyboard image uses 16:9. Do not default to "landscape project + vertical reference frame + crop in post."
- Ref2VA jobs explicitly submit `ratio=16:9`.
- The official I2VA / FL2VA API treats `ratio` as `adaptive`; actual aspect ratio comes from the first/last input frame, so those frames must themselves be 16:9.
- Use landscape relationship language in composition descriptions: `left/right third`, `foreground/background plane`, `lateral separation`, and `negative space`. Do not retain a vertical-video habit of "character centered, subtitles above and below."
- `production.json`, the director package, storyboard, H3 job, and edit plan must use the same aspect ratio within a project.

## 4. Post-production and derivatives

Rough cuts use `contain-pad` to normalize input sizes rather than stretching. Black bars mean upstream segments are misaligned in aspect ratio or composition and must be recorded in QC.

Platform derivatives such as 9:16 and 1:1 are new delivery artifacts. They need separate reframing, subtitle safe areas, and review; treating a center crop from a 16:9 master as automatic completion is not acceptable. If multiple aspect ratios are needed, establish protected composition and version dependencies from the directing stage.
