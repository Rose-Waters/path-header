
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

suite('Path Header Extension Tests', () => {
    let tempDir: string;

    suiteSetup(async () => {
        tempDir = await fs.mkdtemp(
            path.join(os.tmpdir(), 'path-header-test-')
        );
    });

    suiteTeardown(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    async function createEmptyFile(
        filename: string
    ): Promise<vscode.TextDocument> {
        const filePath = path.join(tempDir, filename);
        await fs.writeFile(filePath, '', 'utf8');

        return vscode.workspace.openTextDocument(
            vscode.Uri.file(filePath)
        );
    }

    async function activateExtension(): Promise<void> {
        const extension = vscode.extensions.all.find(
            item => item.packageJSON.name === 'path-header'
        );

        assert.ok(extension, 'Path Header extension should be available');

        await extension.activate();
    }

    test('Registers the Add File Path command', async () => {
        await activateExtension();

        const commands = await vscode.commands.getCommands(true);

        assert.ok(
            commands.includes('path-header.addFilePath'),
            'Add File Path command should be registered'
        );
    });

    test('Adds a header to an empty TypeScript file', async () => {
        await activateExtension();

        const document = await createEmptyFile('example.ts');
        await vscode.window.showTextDocument(document);

        await vscode.commands.executeCommand('path-header.addFilePath');

        const firstLine = document.lineAt(0).text;

        assert.ok(firstLine.startsWith('// '), `Unexpected header: ${firstLine}`);
        assert.ok(firstLine.includes('example.ts'));
        assert.ok(!firstLine.includes('path-header:'));
    });

    test('Uses hash comments for Python files', async () => {
        await activateExtension();

        const document = await createEmptyFile('example.py');
        await vscode.window.showTextDocument(document);

        await vscode.commands.executeCommand('path-header.addFilePath');

        const firstLine = document.lineAt(0).text;

        assert.ok(firstLine.startsWith('# '), `Unexpected header: ${firstLine}`);
        assert.ok(firstLine.includes('example.py'));
    });

    test('Does not add comments to strict JSON files', async () => {
        await activateExtension();

        const document = await createEmptyFile('example.json');
        await vscode.window.showTextDocument(document);

        await vscode.commands.executeCommand('path-header.addFilePath');

        assert.strictEqual(document.getText(), '');
    });

    test('Does not duplicate a tracked header', async () => {
        await activateExtension();

        const document = await createEmptyFile('duplicate.ts');
        await vscode.window.showTextDocument(document);

        await vscode.commands.executeCommand('path-header.addFilePath');

        const firstHeader = document.lineAt(0).text;

        await vscode.commands.executeCommand('path-header.addFilePath');

        const lines = document.getText().split(/\r?\n/);
        const occurrences = lines.filter(
            line => line.trim() === firstHeader.trim()
        ).length;

        assert.strictEqual(
            document.lineAt(0).text,
            firstHeader,
            'The original header should remain unchanged'
        );

        assert.strictEqual(
            occurrences,
            1,
            `Expected one header, found ${occurrences}. Document contents:\n${document.getText()}`
        );
    });

    test('Registers the automatic insertion toggle command', async () => {
        await activateExtension();

        const commands = await vscode.commands.getCommands(true);

        assert.ok(
            commands.includes('path-header.toggleAutoInsert'),
            'The automatic insertion toggle should be registered'
        );
    });
});
