import fetchMock from 'jest-fetch-mock';
import { FunctionEndpoint } from '.';
import { EntryEndpoint } from '..';
import { HttpMethod, HttpHeader } from '../../http';

fetchMock.enableMocks();
let endpoint: FunctionEndpoint<{input: string}, {output: string}>;

beforeEach(() => {
    fetchMock.resetMocks();
    endpoint = new FunctionEndpoint(new EntryEndpoint('http://localhost/'), 'endpoint');
});

test('invoke', async () => {
    fetchMock.mockOnceIf(
        req => req.method === HttpMethod.Post && req.url === 'http://localhost/endpoint',
        async req => {
            expect(req.headers.get(HttpHeader.ContentType)).toBe('application/json');
            expect(await req.text()).toBe('{"input":"in"}');
            return {
                headers: { [HttpHeader.ContentType]: 'application/json' },
                body: '{"output":"out"}'
            };
        }
    );

    const result = await endpoint.invoke({input: "in"});
    expect(result).toEqual({output: "out"});
});
