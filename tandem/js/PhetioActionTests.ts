// Copyright 2022-2023, University of Colorado Boulder

/**
 * Unit tests for PhetioObject
 *
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import PhetioAction from './PhetioAction.js';
import Tandem from './Tandem.js';
import NumberIO from './types/NumberIO.js';

QUnit.module( 'PhetioAction' );

QUnit.test( 'PhetioAction execute', assert => {

  let count = 0;

  const invokeActionOnce = () => phetioAction.execute( ++count );

  const action = ( currentCount: number ) => {
    assert.ok( count === currentCount, 'current count' + count );

    if ( currentCount === 1 ) {
      invokeActionOnce();
    }
  };
  const phetioAction = new PhetioAction<[ number ]>( action, {
    parameters: [ { name: 'count', phetioType: NumberIO } ],
    tandem: Tandem.ROOT_TEST.createTandem( 'phetioAction' )
  } );

  invokeActionOnce();
  assert.ok( count === 2, 'called twice' );
  invokeActionOnce();
  assert.ok( count === 3, 'and once more' );

  phetioAction.dispose();
} );

QUnit.test( 'PhetioAction reentrant disposal', assert => {

  let count = 0;

  const invokeActionOnce = () => phetioAction.execute( ++count );

  // We must call super.dispose() immediately, but we delay disposing the executedEmitter to prevent wonky reentrant behavior.
  const actionDisposedItself = () => phetioAction.executedEmitter.isDisposed;

  const action = ( currentCount: number ) => {
    assert.ok( count === currentCount, 'current count' + count );

    if ( currentCount === 1 ) {
      invokeActionOnce();
    }
    else if ( currentCount === 2 ) {
      invokeActionOnce();
      phetioAction.dispose();
    }
    assert.ok( !actionDisposedItself(), 'should not be disposed until after executing ' + currentCount );
  };
  const phetioAction = new PhetioAction<[ number ]>( action, {
    parameters: [ { name: 'count', phetioType: NumberIO } ],
    tandem: Tandem.ROOT_TEST.createTandem( 'phetioAction' )
  } );

  // @ts-expect-error INTENTIONAL for testing
  const v = phetioAction.getValidationErrors( 'hello' );
  assert.ok( v.length === 1, 'should have one validation error' );
  assert.ok( typeof v[ 0 ] === 'string', 'should have correct validation error' );

  phetioAction.executedEmitter.addListener( ( currentCount: number ) => {
    assert.ok( !actionDisposedItself(), 'should not be disposed until after emitting ' + currentCount );
    assert.ok( count === 3, 'count will always be last because all execute calls come before all emitting ' + currentCount );
  } );

  invokeActionOnce();
  assert.ok( count === 3, 'three calls total' );
  assert.ok( actionDisposedItself(), 'should now be disposed' );
} );