import { expect } from 'chai';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

// runs npm cross-platform: through the npm-cli.js that launched this process
// when available, otherwise through the npm on the PATH
function npm(args, cwd) {
    if (process.env.npm_execpath) {
        return execFileSync(process.execPath, [process.env.npm_execpath, ...args], { cwd, encoding: 'utf-8' });
    }
    const cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    return execFileSync(cmd, args, { cwd, encoding: 'utf-8', shell: process.platform === 'win32' });
}

describe('packaged tarball (smoke test)', function() {
    this.timeout(120000);

    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
    let tmp;
    let installedDir;

    function runInstalledCli(args) {
        return spawnSync(process.execPath, [path.join(installedDir, 'index.js'), ...args], { encoding: 'utf-8' });
    }

    before(function() {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'css-image-checker-smoke-'));
        npm(['pack', '--pack-destination', tmp], root);
        const tarball = path.join(tmp, `${pkg.name}-${pkg.version}.tgz`);
        fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({
            name: 'smoke-test',
            version: '1.0.0',
            private: true
        }));
        npm(['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], tmp);
        installedDir = path.join(tmp, 'node_modules', pkg.name);
    });

    after(function() {
        if (tmp) {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('should ship index.js in the tarball', function() {
        expect(fs.existsSync(path.join(installedDir, 'index.js'))).to.equal(true);
    });

    it('should not ship tests or configs in the tarball', function() {
        expect(fs.existsSync(path.join(installedDir, 'test'))).to.equal(false);
        expect(fs.existsSync(path.join(installedDir, 'eslint.config.js'))).to.equal(false);
    });

    it('should expose the css-image-checker bin', function() {
        const bin = process.platform === 'win32' ? 'css-image-checker.cmd' : 'css-image-checker';
        expect(fs.existsSync(path.join(tmp, 'node_modules', '.bin', bin))).to.equal(true);
    });

    it('should report its version when installed', function() {
        const res = runInstalledCli(['--version']);
        expect(res.status).to.equal(0);
        expect(res.stdout.trim()).to.equal(pkg.version);
    });

    it('should exit 0 on a folder without CSS problems when installed', function() {
        const res = runInstalledCli(['--folder', path.join(root, 'test', 'css2')]);
        expect(res.status).to.equal(0);
        expect(res.stdout).to.match(/Number of errors: 0/);
    });

    it('should exit 1 on a folder with CSS problems when installed', function() {
        const res = runInstalledCli(['--folder', path.join(root, 'test', 'css1')]);
        expect(res.status).to.equal(1);
        expect(res.stdout).to.match(/Full path not found/);
    });
});
