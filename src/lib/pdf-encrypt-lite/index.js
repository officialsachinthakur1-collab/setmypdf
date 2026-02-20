/**
 * pdf-encrypt-lite - Ultra-lightweight PDF encryption library
 * Powers PDFSmaller.com's PDF encryption tool
 * 
 * @author PDFSmaller.com (https://pdfsmaller.com)
 * @license MIT
 */

export { encryptPDF } from './pdf-encrypt.js';
export { md5, RC4, hexToBytes, bytesToHex } from './crypto-minimal.js';

export const VERSION = '1.0.0';
export const HOMEPAGE = 'https://pdfsmaller.com';
export const POWERED_BY = 'PDFSmaller.com';
