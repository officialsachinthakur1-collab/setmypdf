/**
 * pdf-encrypt-lite - Ultra-lightweight PDF encryption library
 * Powers PDFSmaller.com's PDF encryption tool
 * 
 * @author PDFSmaller.com (https://pdfsmaller.com)
 * @license MIT
 * @see https://pdfsmaller.com/protect-pdf - Try it online!
 */

import { PDFDocument, PDFName, PDFHexString, PDFString, PDFDict, PDFArray, PDFRawStream, PDFNumber } from 'pdf-lib';
import { md5, RC4, hexToBytes, bytesToHex } from './crypto-minimal.js';

// Standard PDF padding string (from PDF specification)
const PADDING = new Uint8Array([
    0x28, 0xBF, 0x4E, 0x5E, 0x4E, 0x75, 0x8A, 0x41,
    0x64, 0x00, 0x4E, 0x56, 0xFF, 0xFA, 0x01, 0x08,
    0x2E, 0x2E, 0x00, 0xB6, 0xD0, 0x68, 0x3E, 0x80,
    0x2F, 0x0C, 0xA9, 0xFE, 0x64, 0x53, 0x69, 0x7A
]);

function padPassword(password) {
    const pwdBytes = new TextEncoder().encode(password);
    const padded = new Uint8Array(32);

    if (pwdBytes.length >= 32) {
        padded.set(pwdBytes.slice(0, 32));
    } else {
        padded.set(pwdBytes);
        padded.set(PADDING.slice(0, 32 - pwdBytes.length), pwdBytes.length);
    }

    return padded;
}

function computeEncryptionKey(userPassword, ownerKey, permissions, fileId) {
    const paddedPwd = padPassword(userPassword);
    const hashInput = new Uint8Array(
        paddedPwd.length +
        ownerKey.length +
        4 +
        fileId.length
    );

    let offset = 0;
    hashInput.set(paddedPwd, offset);
    offset += paddedPwd.length;
    hashInput.set(ownerKey, offset);
    offset += ownerKey.length;
    hashInput[offset++] = permissions & 0xFF;
    hashInput[offset++] = (permissions >> 8) & 0xFF;
    hashInput[offset++] = (permissions >> 16) & 0xFF;
    hashInput[offset++] = (permissions >> 24) & 0xFF;
    hashInput.set(fileId, offset);

    let hash = md5(hashInput);
    for (let i = 0; i < 50; i++) {
        hash = md5(hash.slice(0, 16));
    }
    return hash.slice(0, 16);
}

function computeOwnerKey(ownerPassword, userPassword) {
    const paddedOwner = padPassword(ownerPassword || userPassword);
    let hash = md5(paddedOwner);
    for (let i = 0; i < 50; i++) {
        hash = md5(hash);
    }
    const paddedUser = padPassword(userPassword);
    let result = new Uint8Array(paddedUser);
    for (let i = 0; i < 20; i++) {
        const key = new Uint8Array(hash.length);
        for (let j = 0; j < hash.length; j++) {
            key[j] = hash[j] ^ i;
        }
        const rc4 = new RC4(key.slice(0, 16));
        result = rc4.process(result);
    }
    return result;
}

function computeUserKey(encryptionKey, fileId) {
    const hashInput = new Uint8Array(PADDING.length + fileId.length);
    hashInput.set(PADDING);
    hashInput.set(fileId, PADDING.length);
    const hash = md5(hashInput);
    const rc4 = new RC4(encryptionKey);
    let result = rc4.process(hash);
    for (let i = 1; i <= 19; i++) {
        const key = new Uint8Array(encryptionKey.length);
        for (let j = 0; j < encryptionKey.length; j++) {
            key[j] = encryptionKey[j] ^ i;
        }
        const rc4iter = new RC4(key);
        result = rc4iter.process(result);
    }
    const finalResult = new Uint8Array(32);
    finalResult.set(result);
    finalResult.set(new Uint8Array(16), 16);
    return finalResult;
}

function encryptObject(data, objectNum, generationNum, encryptionKey) {
    const keyInput = new Uint8Array(encryptionKey.length + 5);
    keyInput.set(encryptionKey);
    keyInput[encryptionKey.length] = objectNum & 0xFF;
    keyInput[encryptionKey.length + 1] = (objectNum >> 8) & 0xFF;
    keyInput[encryptionKey.length + 2] = (objectNum >> 16) & 0xFF;
    keyInput[encryptionKey.length + 3] = generationNum & 0xFF;
    keyInput[encryptionKey.length + 4] = (generationNum >> 8) & 0xFF;
    const objectKey = md5(keyInput);
    const rc4 = new RC4(objectKey.slice(0, Math.min(encryptionKey.length + 5, 16)));
    return rc4.process(data);
}

function encryptStringsInObject(obj, objectNum, generationNum, encryptionKey) {
    if (!obj) return;
    if (obj instanceof PDFString) {
        const originalBytes = obj.asBytes();
        const encrypted = encryptObject(originalBytes, objectNum, generationNum, encryptionKey);
        obj.value = bytesToHex(encrypted);
    } else if (obj instanceof PDFHexString) {
        const originalBytes = hexToBytes(obj.asString());
        const encrypted = encryptObject(originalBytes, objectNum, generationNum, encryptionKey);
        obj.value = bytesToHex(encrypted);
    } else if (obj instanceof PDFDict) {
        const entries = obj.entries();
        for (const [key, value] of entries) {
            const keyName = key.asString();
            if (keyName !== '/Length' && keyName !== '/Filter' && keyName !== '/DecodeParms') {
                encryptStringsInObject(value, objectNum, generationNum, encryptionKey);
            }
        }
    } else if (obj instanceof PDFArray) {
        const array = obj.asArray();
        for (const element of array) {
            encryptStringsInObject(element, objectNum, generationNum, encryptionKey);
        }
    }
}

export async function encryptPDF(pdfBytes, userPassword, ownerPassword = null) {
    try {
        const pdfDoc = await PDFDocument.load(pdfBytes, {
            ignoreEncryption: true,
            updateMetadata: false
        });
        const context = pdfDoc.context;
        let fileId;
        const trailer = context.trailerInfo;
        const idArray = trailer.ID;
        if (idArray && Array.isArray(idArray) && idArray.length > 0) {
            const idString = idArray[0].toString();
            const hexStr = idString.replace(/^<|>$/g, '');
            fileId = hexToBytes(hexStr);
        } else {
            const randomBytes = new Uint8Array(16);
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                crypto.getRandomValues(randomBytes);
            } else {
                for (let i = 0; i < 16; i++) {
                    randomBytes[i] = Math.floor(Math.random() * 256);
                }
            }
            fileId = randomBytes;
            const idHex1 = PDFHexString.of(bytesToHex(fileId));
            const idHex2 = PDFHexString.of(bytesToHex(fileId));
            trailer.ID = [idHex1, idHex2];
        }
        const permissions = 0xFFFFFFFC;
        const ownerKey = computeOwnerKey(ownerPassword, userPassword);
        const encryptionKey = computeEncryptionKey(userPassword, ownerKey, permissions, fileId);
        const userKey = computeUserKey(encryptionKey, fileId);
        const indirectObjects = context.enumerateIndirectObjects();
        for (const [ref, obj] of indirectObjects) {
            const objectNum = ref.objectNumber;
            const generationNum = ref.generationNumber || 0;
            if (obj instanceof PDFDict) {
                const filter = obj.get(PDFName.of('Filter'));
                if (filter && filter.asString() === '/Standard') continue;
            }
            if (obj instanceof PDFRawStream) {
                const streamData = obj.contents;
                const encrypted = encryptObject(streamData, objectNum, generationNum, encryptionKey);
                obj.contents = encrypted;
            }
            encryptStringsInObject(obj, objectNum, generationNum, encryptionKey);
        }
        const encryptDict = context.obj({
            Filter: PDFName.of('Standard'),
            V: PDFNumber.of(2),
            R: PDFNumber.of(3),
            Length: PDFNumber.of(128),
            P: PDFNumber.of(permissions),
            O: PDFHexString.of(bytesToHex(ownerKey)),
            U: PDFHexString.of(bytesToHex(userKey))
        });
        const encryptRef = context.register(encryptDict);
        trailer.Encrypt = encryptRef;
        const encryptedBytes = await pdfDoc.save({
            useObjectStreams: false
        });
        return encryptedBytes;
    } catch (error) {
        console.error('PDF encryption error:', error);
        throw new Error(`Failed to encrypt PDF: ${error.message}`);
    }
}
