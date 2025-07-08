// Copyright 2017-2025, University of Colorado Boulder

/**
 * Unit tests for PhetioObject
 *
 * @author Sam Reid (PhET Interactive Simulations)
 */

import IntentionalAny from '../../phet-core/js/types/IntentionalAny.js';
import PhetioObject from './PhetioObject.js';
import Tandem from './Tandem.js';
import IOType from './types/IOType.js';

QUnit.module( 'PhetioObject' );

const MockTypeIO = new IOType<IntentionalAny, IntentionalAny>( 'MockTypeIO', {
  isValidValue: () => true,
  documentation: 'mock type',
  events: [ 'hello' ]
} );

QUnit.test( 'PhetioObject start/start', assert => {
  assert.ok( true, 'initial test' );

  const obj = new PhetioObject( {
    tandem: Tandem.ROOT_TEST,
    phetioType: MockTypeIO,
    phetioState: false
  } );
  obj.phetioStartEvent( 'hello' );
} );

QUnit.test( 'PhetioObject start/end', assert => {
  assert.ok( true, 'initial test' );

  const obj = new PhetioObject( {
    tandem: Tandem.ROOT_TEST.createTandem( 'test1' ),
    phetioType: MockTypeIO,
    phetioState: false
  } );
  obj.phetioStartEvent( 'hello' );
  obj.phetioEndEvent();
} );

QUnit.test( 'PhetioObject end without start', assert => {
  assert.ok( true, 'initial test' );

  const obj = new PhetioObject( {
    tandem: Tandem.ROOT_TEST.createTandem( 'test2' ),
    phetioType: MockTypeIO,
    phetioState: false
  } );

  if ( Tandem.PHET_IO_ENABLED ) {
    window.assert && assert.throws( () => {
      obj.phetioEndEvent();
    }, 'Should throw an assertion error when Ending an unstarted event' );
  }
} );

QUnit.test( 'PhetioObject is a Disposable', assert => {
  const object1 = new PhetioObject();

  assert.ok( !!object1.disposeEmitter, 'disposeEmitter needed' );

  const object2 = new PhetioObject();

  object1.disposeEmitter.addListener( () => object2.dispose() );

  assert.ok( !object1.isDisposed, '1 is not disposed' );
  assert.ok( !object2.isDisposed, '2 is not disposed' );

  object1.dispose();
  assert.ok( object1.isDisposed, '1 is disposed' );
  assert.ok( object2.isDisposed, '2 is disposed' );

  const object3 = new PhetioObject( { isDisposable: false } );
  const object4 = new PhetioObject();
  object4[ 'initializePhetioObject' ]( {}, { isDisposable: false } );

  if ( window.assert ) {
    assert.throws( () => object3.dispose(), 'should throw if isDisposable is false1' );
    assert.throws( () => object4.dispose(), 'should throw if isDisposable is false2' );
  }
} );

Tandem.PHET_IO_ENABLED && QUnit.test( 'no calling addLinkedElement before instrumentation', assert => {
  assert.ok( true, 'always run one test' );

  const obj = new PhetioObject();
  obj.addLinkedElement( new PhetioObject() );

  window.assert && assert.throws( () => {
    obj[ 'initializePhetioObject' ]( {}, {
      tandem: Tandem.ROOT_TEST.createTandem( 'myObject' )
    } );
  }, 'Should throw an assertion because you should not link elements before instrumentation' );
} );

if ( Tandem.PHET_IO_ENABLED ) {

  QUnit.test( 'archetype bugginess when Tandem is not launched yet', assert => {

    // reset Tandem launch status to make sure that nothing goes through to phetioEngine in this test until launched again.
    Tandem.unlaunch();

    assert.ok( true, 'initial test' );

    const object1Tandem = Tandem.ROOT_TEST.createTandem( 'object1' );
    const phetioObject1 = new PhetioObject( { tandem: object1Tandem } );
    assert.ok( !phetioObject1.phetioIsArchetype, 'should not be an archetype before marking' );

    const phetioObject1Child = new PhetioObject( { tandem: object1Tandem.createTandem( 'child' ) } );

    phetioObject1.markDynamicElementArchetype();

    assert.ok( phetioObject1.phetioIsArchetype, 'should be an archetype after marking' );

    // This should actually automatically take effect when we hit markDynamicElementArchetype!
    assert.ok( phetioObject1Child.phetioIsArchetype, 'should look in the tandem buffered elements when it is not in the map' );

    // launch to make sure tandem registration fires listeners
    Tandem.launch();

    assert.ok( phetioObject1.phetioIsArchetype, 'phetioIsArchetype should not have changed after launching' );
    assert.ok( phetioObject1Child.phetioIsArchetype, 'phetioIsArchetype should not have changed after launching for child' );
  } );

  // isDynamicElement is not set in phet brand
  QUnit.test( 'PhetioObject.isDynamicElement', assert => {
    const test1 = Tandem.ROOT_TEST.createTandem( 'test1' );
    const parentTandem = test1.createTandem( 'parent' );
    const child1Tandem = parentTandem.createTandem( 'child1' );
    const child2Tandem = parentTandem.createTandem( 'child2' );
    const child1 = new PhetioObject( {
      tandem: child1Tandem
    } );
    const grandChild1 = new PhetioObject( {
      tandem: child1Tandem.createTandem( 'grandChild' )
    } );
    assert.ok( !child1.phetioDynamicElement, 'direct child not dynamic before parent created' );
    assert.ok( !grandChild1.phetioDynamicElement, 'grandchild not dynamic before parent created' );

    const parent = new PhetioObject( {
      tandem: parentTandem,
      phetioDynamicElement: true
    } );
    assert.ok( parent.phetioDynamicElement, 'parent should be dynamic when marked dynamic' );

    // This will only happen in phet-io brand
    if ( Tandem.PHET_IO_ENABLED ) {

      assert.ok( child1.phetioDynamicElement, 'direct child before parent creation' );
      assert.ok( grandChild1.phetioDynamicElement, 'descendant child before parent creation' );

      const child2 = new PhetioObject( {
        tandem: parentTandem.createTandem( 'child2' )
      } );

      const grandChild2 = new PhetioObject( {
        tandem: child2Tandem.createTandem( 'grandChild' )
      } );

      assert.ok( child2.phetioDynamicElement, 'direct child after parent creation' );
      assert.ok( grandChild2.phetioDynamicElement, 'descendant child after parent creation' );

      child2.markDynamicElementArchetype();

      assert.ok( !child2.phetioDynamicElement, 'Not dynamic if archetype: direct child after parent creation' );
      assert.ok( !grandChild2.phetioDynamicElement, 'Not dynamic if archetype: descendant child after parent creation' );
    }
  } );
}