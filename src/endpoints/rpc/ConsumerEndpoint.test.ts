import fetchMock from 'jest-fetch-mock';
import { ConsumerEndpoint } from '.';
import { EntryEndpoint } from '..';
import { HttpMethod, HttpHeader } from '../../http';

class MockEntity {
    constructor(public id: number, public name: string) { }
}

fetchMock.enableMocks();
let endpoint: ConsumerEndpoint<MockEntity>;

beforeEach(() => {
    fetchMock.resetMocks();
    endpoint = new ConsumerEndpoint(new EntryEndpoint('http://localhost/'), 'endpoint');
});

test('invoke', async () => {
    fetchMock.mockOnceIf(
        req => req.method === HttpMethod.Post && req.url === 'http://localhost/endpoint',
        async req => {
            expect(req.headers.get(HttpHeader.ContentType)).toBe('application/json');
            expect(await req.text()).toBe('{"id":1,"name":"input"}');
            return {};
        }
    );

    await endpoint.invoke(new MockEntity(1, 'input'));
});
