import { expect } from 'chai';
import path from 'node:path';
import { spawn } from 'node:child_process';

const indexPath = path.join(process.cwd(), 'index.js');

function runTest(args) {
    return new Promise((resolve, reject) => {
        let out = '';
        const proc = spawn('node', [indexPath, ...args]);

        proc.stdout.on('data', (data) => {
            out += data.toString();
        });

        proc.stderr.on('data', (data) => {
            console.error('stderr:', data.toString());
        });

        proc.on('exit', (code) => {
            resolve({ code, out });
        });

        proc.on('error', reject);
    });
}

describe('index.js', function () {
    this.timeout(8000);

    it('should exit 1 having css problems', async () => {
        const { code, out } = await runTest(['--folder', 'test/css1']);
        expect(code).to.equal(1);
        expect(out).to.match(/Error found in:.*?style\.css/);
        expect(out).to.match(/Full path not found.*?img[/\\]404\.png/);
        expect(out).to.match(/Path in CSS file: \.\.\/img\/404\.png\?v=5/);
        expect(out).to.match(/Original path in CSS file: \.\.\/img\/404\.png/);
    });

    it('should exit 0 having no css problems with url params ?', async () => {
        const { code, out } = await runTest(['--folder', 'test/css2']);
        expect(code).to.equal(0);
        expect(out).to.match(/Number of errors: 0/);
    });

    it('should exit 0 having no css problems with verbose', async () => {
        const { code, out } = await runTest(['--verbose', '--folder', 'test/css2']);
        expect(code).to.equal(0);
        expect(out).to.match(/OK: .*?firefox\.png/);
        expect(out).to.match(/Number of errors: 0/);
    });

    it('should exit 0 having no css problems without url params', async () => {
        const { code, out } = await runTest(['--folder', 'test/css3']);
        expect(code).to.equal(0);
        expect(out).to.match(/Number of errors: 0/);
    });

    it('should exit 0 having css problems with url params #', async () => {
        const { code, out } = await runTest(['--folder', 'test/css4']);
        expect(code).to.equal(0);
        expect(out).to.match(/Number of errors: 0/);
    });

    it('should exit 0 having no css problems absolute and url params', async () => {
        const { code, out } = await runTest(['--folder', 'test/css5']);
        expect(code).to.equal(0);
        expect(out).to.match(/Number of errors: 0/);
    });

    it('should exit 1 having css problems absolute', async () => {
        const { code, out } = await runTest(['--folder', 'test/css6']);
        expect(code).to.equal(1);
        expect(out).to.match(/Error found in:.*?style\.css/);
        expect(out).to.match(/Full path not found:.*?css6[/\\]404[/\\]firefox\.png/);
        expect(out).to.match(/Path in CSS file: \/404\/firefox\.png\?#iefix/);
        expect(out).to.match(/Original path in CSS file: \/404\/firefox\.png/);
        expect(out).to.match(/Full path not found:.*?css6[/\\]40[/\\]firefox\.png/);
        expect(out).to.match(/Path in CSS file: \/40\/firefox\.png/);
        expect(out).to.match(/Number of errors: 2/);
    });

    it('should exit 0 having css problems url', async () => {
        const { code, out } = await runTest(['--folder', 'test/css7']);
        expect(code).to.equal(0);
        expect(out).to.match(/Number of errors: 0/);
    });

    it('should exit 2 if no folder is specified', async () => {
        const { code, out } = await runTest([]);
        expect(code).to.equal(2);
        expect(out).to.match(/Oops! Please specify a folder/);
    });

    it('should exit 3 if folder does not exist', async () => {
        const { code, out } = await runTest(['--folder', '404']);
        expect(code).to.equal(3);
        expect(out).to.match(/Oops! Folder does not exist: 404/);
    });

    it('should exit 4 if folder is not a folder', async () => {
        const { code, out } = await runTest(['--folder', 'test/index.js']);
        expect(code).to.equal(4);
        expect(out).to.match(/Oops! Folder is not a real folder: test[/\\]index\.js/);
    });

    it('should exit 1 on path traversal outside folder root', async () => {
        const { code, out } = await runTest(['--folder', 'test/css8']);
        expect(code).to.equal(1);
        expect(out).to.match(/Path traversal detected/);
    });
});
