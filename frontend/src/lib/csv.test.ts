import { expect, it } from 'vitest'

import { toCsv } from './csv'

it('escapes commas and quotes and leaves empty cells for nulls', () => {
  expect(toCsv(['a', 'b'], [[1, 'x,y'], [null, 'say "hi"']])).toBe('a,b\n1,"x,y"\n,"say ""hi"""\n')
})
