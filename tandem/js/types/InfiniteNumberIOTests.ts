// Copyright 2021-2024, University of Colorado Boulder

/**
 * Unit tests for InfiniteNumberIO
 *
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import InfiniteNumberIO from './InfiniteNumberIO.js';

QUnit.module( 'InfiniteNumberIO' );

QUnit.test( 'serialization', assert => {

  assert.ok( InfiniteNumberIO.toStateObject( 5 ) === 5, 'simple case' );

  assert.ok( InfiniteNumberIO.toStateObject( Number.POSITIVE_INFINITY ) === 'POSITIVE_INFINITY', 'serialization positive infinity' );
  assert.ok( InfiniteNumberIO.toStateObject( Number.NEGATIVE_INFINITY ) === 'NEGATIVE_INFINITY', 'serialization negative infinity' );

  assert.ok( InfiniteNumberIO.fromStateObject( InfiniteNumberIO.toStateObject( Number.POSITIVE_INFINITY ) ) === Number.POSITIVE_INFINITY, 'deserialization positive infinity' );
  assert.ok( InfiniteNumberIO.fromStateObject( InfiniteNumberIO.toStateObject( Number.NEGATIVE_INFINITY ) ) === Number.NEGATIVE_INFINITY, 'deserialization negative infinity' );

  window.assert && assert.throws( () => {

    // @ts-expect-error INTENTIONAL for testing
    InfiniteNumberIO.toStateObject( 4 * 'oh hello' );
  } );
  window.assert && assert.throws( () => {

    // @ts-expect-error INTENTIONAL for testing
    InfiniteNumberIO.toStateObject( 'oh hello' );
  } );
} );