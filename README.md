# Vice Beach Roads

An interactive road and lane map for the Yanis mapping community, with an
OpenDRIVE download. Geometry follows the Yanis map; road organisation is a
community reconstruction and can be improved through issues.

Drag to pan and scroll to zoom. Select **Set start** and **Set destination**,
then click driving lanes to plan a route. Routing follows the connections in
the OpenDRIVE file; disconnected or one-way routes may be unavailable.

Click any map location to copy its coordinates, a shareable link, or issue
details. Coordinates use the **15,000 × 20,000** Yanis canvas: the upper-left
corner is X=0, Z=0; X increases east and Z increases south. OpenDRIVE uses
`x=X, y=−Z`. Absolute road elevations are not surveyed.

## Preview locally

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000/>. No package installation or build step is needed.

## GitHub Pages

Publish directly from the `main` branch:

1. Open **Settings → Pages**.
2. Set **Source → Deploy from a branch**.
3. Select **main** and **/(root)**, then click **Save**.

The repository already contains the complete static site and a root `.nojekyll`
file. No custom GitHub Actions workflow or Jekyll build is required. Push updates
to `main` to publish them. Project sites under `/repository-name/` are supported;
every asset uses a relative URL.

## Report a problem

Select the problem location and use **Copy issue details**. Paste those details
into a GitHub issue and explain the expected layout. A screenshot or reference
is welcome. The map link restores the selected location and route endpoints.

Base map: Yanis. Road cartography: ViceMineMap2 contributors.
