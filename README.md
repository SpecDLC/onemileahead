# One Mile Ahead

> Texas historical markers, one mile ahead.

**Live:** https://onemileahead.specdlc.com · **Part of:** [SpecDLC](https://specdlc.com), spec-driven delivery with acceptance criteria as the contract.

One Mile Ahead is an offline-first app for Texas Historical Commission markers. Look up a marker by number, search the inscription, or see which markers are nearby. The marker list lives in the browser after the first load, so the lookup still works with the network off.

The page is a React app. An engine in Rust, compiled to WebAssembly, implements the same lookup, nearby and research logic plus an "ahead" command; for now the app uses it only behind the `?engine=wasm` flag.

## What it does

- **Lookup by number.** A full marker number shows that marker first. A digit prefix shows the exact match, then the lowest numbers that start with those digits.
- **Search.** A word search checks the title, county, city, and inscription.
- **Nearby.** Ranks markers by distance from you.
- **Offline.** The first visit stores the marker list. Later visits open from that copy.

## The contract: acceptance criteria

The app is built against written acceptance criteria in [`specs/acceptance/`](specs/acceptance/). They are **drafts** until ratified. Each card states a claim, the check that can refute it, and the reading taken against the code.

## Layout

```
crates/oma-core     Rust engine: load, lookup, search, nearby, ahead, research
crates/oma-wasm     C ABI shell: JSON in, JSON out
src/                React app
public/data/        Processed marker list (markers.json)
e2e/                Browser checks
specs/              Acceptance criteria, design, and requirements
build.sh            Rust tests, WASM build, then npm test
```

## Run it locally

```sh
npm ci
npm test
npm run build
cargo test --workspace --release
```

`npm run build` writes `dist/`. `rust-toolchain.toml` pins the Rust version.

`./build.sh` runs the Rust tests, rebuilds the WASM engine, and runs `npm test`. Its last step assembles a demo page from files that are not in this repository. Use `./build.sh --wasm` when you only need a new engine binary.

## How this repo is published

This repository holds the polished, reviewed parts of the project: the acceptance criteria, the engine, the app, and the processed marker list. Each change arrives as a release pull request that has passed a secret scan and a privacy scan and is approved before merge.

The raw marker download and the shapefile are not in this repository.

Issues and suggestions are welcome. Pull requests are read and, when accepted, folded into the next release.

## License

MIT. See [LICENSE](LICENSE).
