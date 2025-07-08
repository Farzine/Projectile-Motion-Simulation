// Copyright 2020-2023, University of Colorado Boulder

/**
 * Unit tests for PhetioObject
 *
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import PhetioGroup from './PhetioGroup.js';
import PhetioObject from './PhetioObject.js';
import Tandem from './Tandem.js';
import IOType from './types/IOType.js';

QUnit.module( 'PhetioGroup' );

QUnit.test( 'PhetioGroup creation and disposal', assert => {

  const createElement = ( tandem: Tandem, otherField: string ) => {
    const element = new PhetioObject( {
      tandem: tandem,
      phetioDynamicElement: true,
      phetioState: false
    } );

    // @ts-expect-error for testing
    element.otherField = otherField;
    return element;
  };
  const phetioGroup = new PhetioGroup( createElement, [ '' ], {
    tandem: Tandem.ROOT_TEST.createTandem( 'phetioGroup' ),
    phetioType: PhetioGroup.PhetioGroupIO( IOType.ObjectIO )
  } );

  phetioGroup.elementCreatedEmitter.addListener( element => {
    assert.ok( phetioGroup.includes( element ), 'element should be in container data structure' );
    assert.ok( phetioGroup.countProperty.value === phetioGroup[ '_array' ].length, 'element should be in container data structure' );
  } );
  phetioGroup.elementDisposedEmitter.addListener( element => {
    assert.ok( element.isDisposed, 'should be disposed' );
    assert.ok( !phetioGroup.includes( element ), 'should not be in array' );
  } );

  const one = phetioGroup.createNextElement( '' );
  const two = phetioGroup.createNextElement( '' );

  phetioGroup.disposeElement( two );
  phetioGroup.disposeElement( one );

  assert.ok( phetioGroup.countProperty.value === 0, 'no elements left now' );

  phetioGroup.elementCreatedEmitter.addListener( element => {

    // @ts-expect-error for testing
    if ( element.otherField === 'disposeMe!' ) {
      phetioGroup.disposeElement( element );
    }
  } );
  phetioGroup.createNextElement( '' );
  phetioGroup.createNextElement( '' );
  phetioGroup.createNextElement( '' );
  assert.ok( phetioGroup.countProperty.value === 3, 'added three' );
  phetioGroup.createNextElement( 'disposeMe!' );
  assert.ok( phetioGroup.countProperty.value === 3, 'new element should be immediately disposed' );

  window.assert && assert.throws( () => {
    phetioGroup.dispose();
  }, 'cannot dispose phetioGroup' );
} );

QUnit.test( 'PhetioGroup deferring notifications', assert => {

  const createElement = ( tandem: Tandem ) => {
    return new PhetioObject( {
      tandem: tandem,
      phetioDynamicElement: true,
      phetioState: false
    } );
  };
  const myPhetioGroup = new PhetioGroup( createElement, [], {
    tandem: Tandem.ROOT_TEST.createTandem( 'myPhetioGroup' ),
    phetioType: PhetioGroup.PhetioGroupIO( IOType.ObjectIO )
  } );

  let creationCount = 0;
  myPhetioGroup.elementCreatedEmitter.addListener( element => creationCount++ );
  let disposedCount = 0;
  myPhetioGroup.elementDisposedEmitter.addListener( element => disposedCount++ );

  const first = myPhetioGroup.createNextElement();
  assert.ok( creationCount === 1, 'increment one from a single usage' );
  myPhetioGroup.disposeElement( first );
  assert.ok( disposedCount === 1, 'disposed one' );

  myPhetioGroup.setNotificationsDeferred( true );
  const second = myPhetioGroup.createNextElement();
  assert.ok( creationCount === 1, 'deferred, so should not increment' );
  myPhetioGroup.disposeElement( second );
  assert.ok( disposedCount === 1, 'deferred, so should not increment disposed' );

  const third = myPhetioGroup.createNextElement();
  assert.ok( creationCount === 1, 'still deferred, so should not increment' );
  myPhetioGroup.notifyElementCreatedWhileDeferred( third );
  assert.ok( creationCount === 2, 'notification for third went through' );
  myPhetioGroup.disposeElement( third );
  assert.ok( disposedCount === 1, 'still deferred, so should not increment disposed' );

  myPhetioGroup.setNotificationsDeferred( false );
  assert.ok( creationCount === 3, 'only one was flushed' );
  assert.ok( disposedCount === 3, 'two notifications flushed' );

} );