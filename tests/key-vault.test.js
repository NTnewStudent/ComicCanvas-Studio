import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createKeyVault, KeyVaultError } from '../desktop/src/main/security/key-vault';
const secret = 'sk-live-secret-value';
function createAvailableSafeStorage() {
    return {
        isEncryptionAvailable: () => true,
        encryptString: (plainText) => Buffer.from(`encrypted:${plainText}`, 'utf8'),
        decryptString: (encrypted) => {
            const text = Buffer.from(encrypted).toString('utf8');
            if (!text.startsWith('encrypted:')) {
                // Test adapter rejects malformed encrypted payloads.
                throw new Error('bad encrypted payload');
            }
            return text.slice('encrypted:'.length);
        }
    };
}
function captureError(run) {
    try {
        run();
    }
    catch (error) {
        return error;
    }
    throw new Error('expected function to throw');
}
describe('M3 encrypted key vault', () => {
    it('encrypts and decrypts API keys without serialized plaintext', () => {
        const vault = createKeyVault({
            safeStorage: createAvailableSafeStorage(),
            namespace: 'gateway'
        });
        const record = vault.encryptSecret({ providerId: 'openai-main', secret });
        expect(record.keyRef).toBe('gateway:openai-main');
        expect(record.ciphertext).not.toContain(secret);
        expect(JSON.stringify(record)).not.toContain(secret);
        expect(vault.decryptSecret(record)).toBe(secret);
    });
    it('refuses encryption and decryption when safeStorage is unavailable', () => {
        const unavailable = {
            isEncryptionAvailable: () => false,
            encryptString: () => Buffer.from('never-used'),
            decryptString: () => 'never-used'
        };
        const vault = createKeyVault({ safeStorage: unavailable, namespace: 'gateway' });
        expect(() => vault.encryptSecret({ providerId: 'openai-main', secret })).toThrow(KeyVaultError);
        expect(captureError(() => vault.encryptSecret({ providerId: 'openai-main', secret }))).toMatchObject({
            errorClass: 'gateway_secret_unavailable',
            retryable: false
        });
        expect(captureError(() => vault.decryptSecret({ keyRef: 'gateway:openai-main', ciphertext: 'abc' }))).toMatchObject({
            errorClass: 'gateway_secret_unavailable',
            retryable: false
        });
    });
    it('does not leak plaintext secrets from encryption or decryption errors', () => {
        const failing = {
            isEncryptionAvailable: () => true,
            encryptString: () => {
                // Simulates an OS keychain failure that included the sensitive value in the native error.
                throw new Error(`native failed for ${secret}`);
            },
            decryptString: () => {
                // Simulates an OS keychain decrypt failure that included the sensitive value in the native error.
                throw new Error(`decrypt failed for ${secret}`);
            }
        };
        const vault = createKeyVault({ safeStorage: failing, namespace: 'gateway' });
        expect(() => vault.encryptSecret({ providerId: 'openai-main', secret })).toThrow('Secret storage is unavailable');
        expect(() => vault.encryptSecret({ providerId: 'openai-main', secret })).not.toThrow(secret);
        expect(() => vault.decryptSecret({ keyRef: 'gateway:openai-main', ciphertext: Buffer.from(secret).toString('base64') })).not.toThrow(secret);
    });
    it('keeps production key vault source free of hardcoded API keys', () => {
        const source = readFileSync('desktop/src/main/security/key-vault.ts', 'utf8');
        expect(source).not.toMatch(/sk-[A-Za-z0-9_-]{8,}/u);
        expect(source).not.toContain(secret);
    });
});
