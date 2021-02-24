# "Plaza" Example

Explore various environments connected in a grid with spatial audio between them.

!["Plaza" Example Screenshot](./screenshot.png)

## Author

Sabrina Shanman, Jazmin Cano

## Usage

1. Install [NodeJS v14.15.x](https://nodejs.org/en/)
2. Install [npm](https://docs.npmjs.com/getting-started/configuring-your-local-environment)
    - MacOS: If you encounter admin priviledge errors, add `prefix=/Users/yourusername/.npm-global` to your `~/.npmrc` (or another prefix)
2. Run `npm install` in this directory
3. Copy `auth.example.json` to `auth.json`
4. Populate your credentials inside `auth.json`
    - Obtain `HIFI_*` credentials from [High Fidelity's Spatial Audio API Developer Console](https://account.highfidelity.com/dev/account)
5. Run `npm run start`
6. Navigate to `localhost:8080` in [your browser](https://www.highfidelity.com/knowledge/what-devices-are-compatible) and click the "Click to Connect" button
