// Copyright 2020-2022, University of Colorado Boulder

/**
 * Unit tests for PhetioObject
 *
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import NumberProperty from '../../axon/js/NumberProperty.js';
import Tandem from './Tandem.js';

QUnit.module( 'Tandem' );

QUnit.test( 'Tandem validation on ROOT', assert => {

  let property = new NumberProperty( 0, {
    tandem: Tandem.ROOT_TEST.createTandem( 'aProperty' )
  } );
  assert.ok( property.isPhetioInstrumented(), 'should be instrumented' );

  property = new NumberProperty( 0, {
    tandem: Tandem.ROOT_TEST.createTandem( 'bProperty' )
  } );
  assert.ok( property.isPhetioInstrumented(), 'should be instrumented' );

  property = new NumberProperty( 0, {
    tandem: Tandem.ROOT_TEST.createTandem( 'cProperty' )
  } );
  assert.ok( property.isPhetioInstrumented(), 'should be instrumented' );

  // Only specific tandems allowed on root when validating tandems
  window.assert && Tandem.VALIDATION && assert.throws( () => {
    property = new NumberProperty( 0, {
      tandem: Tandem.ROOT.createTandem( 'aProperty' ) // Should fail because aProperty is not allowed on ROOT Tandem
    } );
  } );
} );

QUnit.test( 'Tandem excluded', assert => {
  assert.ok( true, 'hello beautiful world.' );

  Tandem.ROOT_TEST.createTandem( 'anythingAllowedHere' );

  window.assert && Tandem.VALIDATION && assert.throws( () => {
    Tandem.ROOT_TEST.createTandem( 'pickableProperty' );
  }, 'pickableProperty should never be instrumented' );
} );