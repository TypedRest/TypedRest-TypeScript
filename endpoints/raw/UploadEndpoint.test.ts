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
    const data = new Blob([new Uint8Array([1, 2, 3])], { type: 'mock/type' });

    fetchMock.mockOnceIf(
        req => req.method === HttpMethod.Post && req.url === 'http://localhost/endpoint',
        async req => {
            expect(req.headers.get(HttpHeader.ContentType)).toBe('multipart/form-data');
            return {};
        }
    );
    await endpoint.upload(data, 'file.dat');
});
