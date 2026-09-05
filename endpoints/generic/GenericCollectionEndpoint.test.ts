/**
 * NOTE: The jsdom environment strips the "Range" request header, so these tests need the node environment.
 * @jest-environment node
 */

import fetchMock from 'jest-fetch-mock';
import { CollectionEndpoint } from '.';
import { EntryEndpoint } from '..';
import { HttpHeader, HttpStatusCode, HttpContentRange } from '../../http';
import { RangeNotSatisfiableError } from '../../errors';

class MockEntity {
    constructor(public id: number, public name: string) { }
}

fetchMock.enableMocks();
let endpoint: CollectionEndpoint<MockEntity>;

beforeEach(() => {
    fetchMock.resetMocks();
    endpoint = new CollectionEndpoint(new EntryEndpoint('http://localhost/'), 'endpoint');
});

test('readRange', async () => {
    fetchMock.mockOnceIf(
        'http://localhost/endpoint',
        async req => {
            expect(req.headers.get(HttpHeader.Range)).toBe('elements=1-2');
            return {
                body: '[{"id":6,"name":"test2"}, {"id":7,"name":"test3"}]',
                status: HttpStatusCode.PartialContent,
                headers: {
                    [HttpHeader.ContentRange]: 'elements 1-2/3'
                }
            };
        }
    );

    const result = await endpoint.readRange(1, 2);
    expect(result.elements).toEqual([new MockEntity(6, 'test2'), new MockEntity(7, 'test3')]);
    expect(result.range).toEqual(new HttpContentRange('elements', 1, 2, 3));
    expect(result.endReached).toBe(true);
});

test('readRangeOffset', async () => {
    fetchMock.mockOnceIf(
        'http://localhost/endpoint',
        async req => {
            expect(req.headers.get(HttpHeader.Range)).toBe('elements=1-');
            return {
                body: '[{"id":6,"name":"test2"}]',
                status: HttpStatusCode.PartialContent,
                headers: {
                    [HttpHeader.ContentRange]: 'elements 1-1/*'
                }
            };
        }
    );

    const result = await endpoint.readRange(1);
    expect(result.elements).toEqual([new MockEntity(6, 'test2')]);
    expect(result.range).toEqual(new HttpContentRange('elements', 1, 1, undefined));
    expect(result.endReached).toBe(false);
});

test('readRangeTail', async () => {
    fetchMock.mockOnceIf(
        'http://localhost/endpoint',
        async req => {
            expect(req.headers.get(HttpHeader.Range)).toBe('elements=-1');
            return {
                body: '[{"id":6,"name":"test2"}]',
                status: HttpStatusCode.PartialContent
            };
        }
    );

    const result = await endpoint.readRange(undefined, 1);
    expect(result.elements).toEqual([new MockEntity(6, 'test2')]);
    expect(result.range).toBeUndefined();
    expect(result.endReached).toBe(true);
});

test('readRangeNotSatisfiable', async () => {
    fetchMock.mockOnceIf(
        'http://localhost/endpoint',
        async () => ({ status: HttpStatusCode.RangeNotSatisfiable })
    );

    await expect(endpoint.readRange(1)).rejects.toThrow(RangeNotSatisfiableError);
});

test('readRangeAllowed', async () => {
    expect(endpoint.readRangeAllowed).toBeUndefined();

    fetchMock.mockOnceIf(
        'http://localhost/endpoint',
        '[]',
        {
            headers: {
                [HttpHeader.AcceptRanges]: 'elements'
            }
        }
    );
    await endpoint.readAll();

    expect(endpoint.readRangeAllowed).toBe(true);
});

test('readRangeNotAllowed', async () => {
    fetchMock.mockOnceIf(
        'http://localhost/endpoint',
        '[]',
        {
            headers: {
                [HttpHeader.AcceptRanges]: 'none'
            }
        }
    );
    await endpoint.readAll();

    expect(endpoint.readRangeAllowed).toBe(false);
});
