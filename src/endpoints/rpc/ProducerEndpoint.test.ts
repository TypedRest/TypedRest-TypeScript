import fetchMock from 'jest-fetch-mock';
import { ProducerEndpoint } from '.';
import { EntryEndpoint } from '..';
import { HttpMethod, HttpHeader } from '../../http';

class MockEntity {
    constructor(public id: number, public name: string) { }
}

fetchMock.enableMocks();
let endpoint: ProducerEndpoint<MockEntity>;

beforeEach(() => {
    fetchMock.resetMocks();
    endpoint = new ProducerEndpoint(new EntryEndpoint('http://localhost/'), 'endpoint');
});

test('invoke', async () => {
    fetchMock.mockOnceIf(
        req => req.method === HttpMethod.Post && req.url === 'http://localhost/endpoint',
        async req => {
            expect(req.headers.get(HttpHeader.Accept)).toBe('application/json');
            return {
                headers: { [HttpHeader.ContentType]: 'application/json' },
                body: '{"id":1,"name":"input"}'
            };
        }
    );

    const result = await endpoint.invoke();
    expect(result).toEqual(new MockEntity(1, 'input'));
});
