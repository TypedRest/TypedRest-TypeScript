import fetchMock from 'jest-fetch-mock';
import { UploadEndpoint } from '.';
import { EntryEndpoint } from '..';
import { HttpMethod, HttpHeader } from '../../http';

fetchMock.enableMocks();

beforeEach(() => {
    fetchMock.resetMocks();
});

test('uploadRaw', async () => {
    const endpoint = new UploadEndpoint(new EntryEndpoint('http://localhost/'), 'endpoint');
    const data = new Blob([new Uint8Array([1, 2, 3])], { type: 'mock/type' });

    fetchMock.mockOnceIf(
        req => req.method === HttpMethod.Post && req.url === 'http://localhost/endpoint',
        async req => {
            expect(req.headers.get(HttpHeader.ContentType)).toBe('mock/type');
            return {};
        }
    );
    await endpoint.upload(data);
});

test('uploadForm', async () => {
    const endpoint = new UploadEndpoint(new EntryEndpoint('http://localhost/'), 'endpoint', 'data');
    const file = new File([new Uint8Array([1, 2, 3])], 'file.dat', { type: 'mock/type' });

    // Spy on FormData.prototype.set to verify what's being set
    const setSpy = jest.spyOn(FormData.prototype, 'set');

    fetchMock.mockOnceIf(
        req => req.method === HttpMethod.Post && req.url === 'http://localhost/endpoint',
        async req => {
            expect(req.headers.get(HttpHeader.ContentType)).toBe('multipart/form-data');
            return {};
        }
    );

    await endpoint.upload(file);

    // Verify the FormData was populated correctly with file name and type
    expect(setSpy).toHaveBeenCalledWith('data', file, 'file.dat');
    const capturedFile = setSpy.mock.calls[0][1] as File;
    expect(capturedFile.name).toBe('file.dat');
    expect(capturedFile.type).toBe('mock/type');

    setSpy.mockRestore();
});
