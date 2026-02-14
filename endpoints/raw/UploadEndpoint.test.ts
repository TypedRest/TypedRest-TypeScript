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

    // Spy on FormData.prototype.set to capture what's being set
    let capturedBlob: Blob | File | undefined;
    let capturedFileName: string | undefined;
    const originalSet = FormData.prototype.set;
    const setSpy = jest.spyOn(FormData.prototype, 'set').mockImplementation(function(this: FormData, name: string, value: any, fileName?: string) {
        if (name === 'data') {
            capturedBlob = value;
            capturedFileName = fileName;
        }
        return originalSet.call(this, name, value, fileName);
    });

    fetchMock.mockOnceIf(
        req => req.method === HttpMethod.Post && req.url === 'http://localhost/endpoint',
        async req => {
            expect(req.headers.get(HttpHeader.ContentType)).toBe('multipart/form-data');
            return {};
        }
    );
    
    await endpoint.upload(file);

    // Verify the FormData was populated correctly
    expect(setSpy).toHaveBeenCalledWith('data', file, 'file.dat');
    expect(capturedBlob).toBe(file);
    expect(capturedFileName).toBe('file.dat');
    expect((capturedBlob as File).type).toBe('mock/type');

    setSpy.mockRestore();
});
