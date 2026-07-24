import { expect } from 'chai';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const indexPath = path.join(process.cwd(), 'index.js');

// starts an ANSI escape sequence
const ESC = String.fromCharCode(27);

// matches C0 and C1 control characters except tab, newline and carriage return
const range = (from, to) => String.fromCharCode(from) + '-' + String.fromCharCode(to);
const controlChars = new RegExp('[' + range(0, 8) + range(11, 12) + range(14, 31) + range(127, 159) + ']');

function runTest(args) {
    return new Promise((resolve, reject) => {
        let out = '';
        const proc = spawn('node', [indexPath, ...args]);

        proc.stdout.on('data', (data) => {
            out += data.toString();
        });

        proc.on('exit', (code) => {
            resolve({ code, out });
        });

        proc.on('error', reject);
    });
}

describe('security: malicious CSS filename', function () {
    this.timeout(8000);

    let tmp;

    before(function () {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'css-image-checker-secfile-'));
        // a CSS file whose *name* embeds an ANSI escape sequence and that
        // references a missing image, so the "Error found in: <file>" line runs
        const evilName = 'evil' + ESC + '[31mred.css';
        try {
            fs.writeFileSync(path.join(tmp, evilName), 'a { background: url("missing.png"); }');
        } catch {
            // platforms such as Windows reject control characters in filenames
            this.skip();
        }
    });

    after(function () {
        if (tmp) {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('should not emit control characters from a malicious CSS filename', async () => {
        const { code, out } = await runTest(['--folder', tmp]);
        expect(code).to.equal(1);
        expect(out).to.not.match(controlChars);
    });

    it('should keep the readable part of the sanitized filename', async () => {
        const { out } = await runTest(['--folder', tmp]);
        expect(out).to.match(/Error found in: .*evil\[31mred\.css/);
    });
});

describe('security: symlink escape', function () {
    this.timeout(8000);

    let tmp;
    let root;

    before(function () {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'css-image-checker-secsym-'));
        root = path.join(tmp, 'root');
        const outside = path.join(tmp, 'outside');
        fs.mkdirSync(root);
        fs.mkdirSync(outside);
        // sensitive files that live OUTSIDE the scanned folder; their url()
        // markers must never appear in the output
        fs.writeFileSync(path.join(outside, 'secret.css'), 'a { background: url("SECRET_MARKER.png"); }');
        fs.writeFileSync(path.join(outside, 'deep.css'), 'a { background: url("DEEP_MARKER.png"); }');
        // a legitimate broken file inside root so the tool has real work to do
        fs.writeFileSync(path.join(root, 'real.css'), 'a { background: url("missing.png"); }');
        try {
            // a symlinked file and a symlinked directory, both pointing outside root
            fs.symlinkSync(path.join(outside, 'secret.css'), path.join(root, 'link.css'));
            fs.symlinkSync(outside, path.join(root, 'linkdir'), 'dir');
        } catch {
            // creating symlinks may require privileges (e.g. unprivileged Windows)
            this.skip();
        }
    });

    after(function () {
        if (tmp) {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('should still report the legitimate in-folder error', async () => {
        const { code, out } = await runTest(['--folder', root]);
        expect(code).to.equal(1);
        expect(out).to.match(/Error found in:.*real\.css/);
    });

    it('should not read a CSS file reached through a symlink out of the folder', async () => {
        const { out } = await runTest(['--folder', root]);
        expect(out).to.not.match(/SECRET_MARKER/);
    });

    it('should not descend into a symlinked directory out of the folder', async () => {
        const { out } = await runTest(['--folder', root]);
        expect(out).to.not.match(/DEEP_MARKER/);
    });
});
