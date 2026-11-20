<div align="center">

# Zayelle Photo Pipeline

**Drop in a product photo, get two optimised WebPs back.**

One Sharp resize function, three ways to run it: on your laptop, in a Next.js upload UI, and in AWS Lambda when a photo lands in S3.

![Node](https://img.shields.io/badge/Node-22-339933?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![Sharp](https://img.shields.io/badge/Sharp-0.35-99CC00)
![AWS SAM](https://img.shields.io/badge/AWS-SAM%20%C2%B7%20Lambda%20%C2%B7%20S3-FF9900?logo=amazonaws&logoColor=white)

</div>

---

## Why

Product photos straight off a camera or phone are huge (often 3–10 MB). A storefront doesn't need that. This pipeline turns every original into two web-ready WebP files:

| Size    | Width   | Quality | Used for                         |
| ------- | ------- | ------- | -------------------------------- |
| `large` | 1200 px | 80      | Product page / zoom view         |
| `thumb` | 400 px  | 75      | Grids, carts, search results     |

Images are never upscaled, and EXIF orientation is respected so phone shots don't come out sideways.

## How it works

```
                        ┌──────────────────────┐
  samples/red-dress.jpg │                      │──▶ red-dress-large.webp  (1200w)
  ── or ── UI upload  ─▶│   src/resize.ts      │
  ── or ── S3 upload    │   Sharp → WebP ×2    │──▶ red-dress-thumb.webp  (400w)
                        └──────────────────────┘
```

The resize logic lives in **one place**, `src/resize.ts`. Everything else is a thin wrapper around it:

| Entry point               | Where it runs | Reads from            | Writes to             |
| ------------------------- | ------------- | --------------------- | --------------------- |
| `src/local.ts`            | Your laptop   | `samples/`            | `output/`             |
| `app/api/resize/route.ts` | Next.js dev   | Browser upload        | `output/` + browser   |
| `src/handler.ts`          | AWS Lambda    | Originals S3 bucket   | Processed S3 bucket   |

Because all three call the same function, a photo processed locally comes out exactly the same as one processed in Lambda.

### In the cloud

```
  aws s3 cp photo.jpg ──▶ [ Originals bucket ] ──S3 event──▶ [ ResizeFunction λ ]
                                                                     │
                                       [ Processed bucket ] ◀────────┘
                                         photo-large.webp
                                         photo-thumb.webp
```

Originals and outputs live in **separate buckets** so writing the WebPs never re-triggers the function (no infinite loop).

## Project structure

```
zayelle-photo-pipeline/
├── app/
│   ├── page.tsx           # Upload UI
│   ├── layout.tsx         # Fonts + metadata
│   ├── globals.css        # Grid / tech-line styling
│   └── api/resize/
│       └── route.ts       # Upload endpoint → resizeToWebp()
├── src/
│   ├── resize.ts          # Uses Sharp to generate both WebP sizes
│   ├── local.ts           # Runs the resize function on a photo from your laptop
│   └── handler.ts         # Calls the same resize function when S3 triggers Lambda
├── samples/               # Your local test photos (git-ignored)
├── output/                # Generated WebPs appear here locally (git-ignored)
├── template.yaml          # AWS SAM: two buckets + Lambda + S3 trigger
├── package.json           # Dependencies and npm scripts
├── tsconfig.json          # TypeScript settings
└── .gitignore             # Keeps local photos and generated files out of Git
```

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org) 22+
- For deploying: [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html), [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html), and [Docker](https://www.docker.com/) (SAM builds inside a container)

### Install

```bash
git clone https://github.com/zainab-kassim/zayelle-photo-pipeline.git
cd zayelle-photo-pipeline
npm install
```

### 1. Run on your laptop

Put a photo in `samples/` (the default is `samples/red-dress.jpg`), then:

```bash
npm run local                        # uses samples/red-dress.jpg
npm run local -- samples/other.jpg   # or any other photo
```

The two WebPs are written to `output/`.

### 2. Run the upload UI

```bash
npm run dev
```

Open the URL Next prints (usually http://localhost:3000), drop a photo in, and hit **Run pipeline**. You get a preview, dimensions, file size and % saved for each output, plus a download link. Copies are saved to `output/` as well.

### 3. Deploy to AWS

```bash
npm run deploy
```

This bundles `src/handler.ts` with esbuild, runs `sam build --use-container`, then `sam deploy --guided`. The first deploy asks a few questions (stack name, region). Accept the defaults and save them to `samconfig.toml`.

Then test it:

```bash
aws s3 cp samples/red-dress.jpg s3://<OriginalsBucketName>/
aws s3 ls s3://<ProcessedBucketName>/
```

The bucket names are printed in the deploy outputs.

> **Why `--use-container`?** Sharp ships native binaries. Building on a Mac would install the macOS build, which crashes in Lambda. Building in the Lambda container gets the Linux arm64 binary.

## npm scripts

| Script                 | What it does                                          |
| ---------------------- | ----------------------------------------------------- |
| `npm run dev`          | Start the Next.js upload UI                           |
| `npm run local`        | Resize a photo from `samples/` into `output/`         |
| `npm run typecheck`    | Type-check everything with `tsc --noEmit`             |
| `npm run build:lambda` | Bundle `src/handler.ts` → `dist/handler.js`           |
| `npm run sam:build`    | `build:lambda` + `sam build --use-container`          |
| `npm run deploy`       | `sam:build` + `sam deploy --guided`                   |

## AWS resources

Defined in [`template.yaml`](template.yaml):

| Resource           | Type             | Notes                                                    |
| ------------------ | ---------------- | -------------------------------------------------------- |
| `OriginalsBucket`  | S3 bucket        | Private. `ObjectCreated` events trigger the function     |
| `ProcessedBucket`  | S3 bucket        | Private. Receives `*-large.webp` and `*-thumb.webp`      |
| `ResizeFunction`   | Lambda (Node 22) | arm64, 1024 MB, 30 s timeout. Read originals, write processed |

Outputs are written with `Content-Type: image/webp` and a long-lived `Cache-Control` header, ready to sit behind a CDN.

### Cost

For a demo this costs roughly nothing. Lambda's always-free allowance covers 1M requests per month, and a handful of WebPs in S3 costs fractions of a cent. When you're done, tear it down:

```bash
aws s3 rm s3://<OriginalsBucketName> --recursive
aws s3 rm s3://<ProcessedBucketName> --recursive
sam delete
```

## Demo results

_Fill this in after running the pipeline on `samples/red-dress.jpg`._

| File                     | Dimensions | Size | vs original |
| ------------------------ | ---------- | ---- | ----------- |
| `red-dress.jpg` (original) | —        | —    | —           |
| `red-dress-large.webp`   | —          | —    | —           |
| `red-dress-thumb.webp`   | —          | —    | —           |

## Tech stack

- **[Sharp](https://sharp.pixelplumbing.com/)**: fast image processing on top of libvips
- **[Next.js](https://nextjs.org/)** + **React**: upload UI and API route
- **[AWS SAM](https://aws.amazon.com/serverless/sam/)**: infrastructure as code for Lambda + S3
- **[esbuild](https://esbuild.github.io/)**: bundles the Lambda handler
- **[tsx](https://tsx.is/)**: runs TypeScript directly for local testing

---

<div align="center">
<sub>Built for Zayelle</sub>
</div>
