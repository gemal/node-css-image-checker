import { expect } from 'chai';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const indexPath = path.join(process.cwd(), 'index.js');

// control characters built at runtime so this source file stays plain ASCII
const ESC = String.fromCharCode(27); // starts ANSI escape sequences
const BEL = String.fromCharCode(7); // terminates OSC sequences
const CSI = String.fromCharCode(155); // single-byte control sequence introducer

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

describe('output sanitizing', function () {
    this.timeout(8000);

    let tmp;

    before(function () {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'css-image-checker-sanitize-'));
        fs.writeFileSync(path.join(tmp, 'style.css'), [
            `a { background: url("mis${ESC}[31msing.png"); }`,
            `b { background: url("gone${BEL}${CSI}.png?v=${ESC}]0;spoof${BEL}1"); }`,
            `c { background: url("../../${ESC}[2Jescape.png"); }`
        ].join('\n'));
    });

    after(function () {
        if (tmp) {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('should not emit any control characters from malicious CSS', async () => {
        const { code, out } = await runTest(['--folder', tmp]);
        expect(code).to.equal(1);
        expect(out).to.not.match(controlChars);
    });

    it('should strip ANSI escapes but keep the readable part of the path', async () => {
        const { out } = await runTest(['--folder', tmp]);
        expect(out).to.match(/Full path not found: .*mis\[31msing\.png/);
        expect(out).to.match(/Path in CSS file: mis\[31msing\.png/);
    });

    it('should sanitize the original-path line for urls with query params', async () => {
        const { out } = await runTest(['--folder', tmp]);
        expect(out).to.match(/Path in CSS file: gone\.png\?v=\]0;spoof1/);
        expect(out).to.match(/Original path in CSS file: gone\.png/);
    });

    it('should sanitize the path traversal message', async () => {
        const { out } = await runTest(['--folder', tmp]);
        expect(out).to.match(/Path traversal detected: \.\.\/\.\.\/\[2Jescape\.png/);
    });

    it('should count all malicious urls as errors', async () => {
        const { out } = await runTest(['--folder', tmp]);
        expect(out).to.match(/Number of errors: 3/);
    });
});
