import {gunzipSync} from 'zlib';

/**
 * Extract a single file from a .tgz (gzipped tar) buffer.
 * Tar format: sequential 512-byte blocks. Each entry has a 512-byte header
 * followed by ceil(filesize/512)*512 bytes of content.
 *
 * Header layout (POSIX ustar):
 *   offset 0   (100 bytes): filename
 *   offset 124  (12 bytes): file size in octal
 *   offset 345 (155 bytes): prefix (prepended to filename)
 */
export function extractFileFromTgz(tgz: Buffer, targetPath: string): Buffer | null {
    const tar = gunzipSync(tgz);
    let offset = 0;

    while (offset + 512 <= tar.length) {
        const header = tar.subarray(offset, offset + 512);

        // End-of-archive: two consecutive zero blocks
        if (header.every((b) => b === 0)) break;

        const nameRaw = header.subarray(0, 100).toString('utf-8').replace(/\0/g, '');
        const prefixRaw = header.subarray(345, 500).toString('utf-8').replace(/\0/g, '');
        const fullName = prefixRaw ? `${prefixRaw}/${nameRaw}` : nameRaw;

        const sizeStr = header.subarray(124, 136).toString('utf-8').replace(/\0/g, '').trim();
        const fileSize = parseInt(sizeStr, 8) || 0;

        offset += 512; // move past header

        if (fullName.endsWith(targetPath) || fullName === targetPath) {
            return tar.subarray(offset, offset + fileSize);
        }

        // Skip file content (padded to 512-byte boundary)
        offset += Math.ceil(fileSize / 512) * 512;
    }

    return null;
}
