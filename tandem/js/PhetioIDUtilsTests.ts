// Copyright 2023-2024, University of Colorado Boulder

/**
 * Unit tests for PhetioIDUtils
 *
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import PhetioIDUtils from './PhetioIDUtils.js';

QUnit.module( 'PhetioIDUtils' );

QUnit.test( 'PhetioIDUtils.append', assert => {

  assert.equal(
    PhetioIDUtils.append( 'circuitConstructionKitDc.introScreen.model.circuit.voltageProperty', 'rangeProperty' ),
    'circuitConstructionKitDc.introScreen.model.circuit.voltageProperty.rangeProperty',
    'basic append' );

  assert.equal(
    PhetioIDUtils.append( '', 'circuitConstructionKitDc' ),
    'circuitConstructionKitDc' );

  assert.equal(
    PhetioIDUtils.append( '', 'circuitConstructionKitDc', 'introScreen' ),
    'circuitConstructionKitDc.introScreen' );

  assert.equal(
    PhetioIDUtils.append( 'circuitConstructionKitDc', 'introScreen', 'model', 'circuit', 'voltageProperty', 'rangeProperty' ),
    'circuitConstructionKitDc.introScreen.model.circuit.voltageProperty.rangeProperty' );

  assert.equal(
    PhetioIDUtils.append( 'circuitConstructionKitDc', 'introScreen', '', 'model', 'circuit', 'voltageProperty', '', 'rangeProperty' ),
    'circuitConstructionKitDc.introScreen.model.circuit.voltageProperty.rangeProperty' );
} );

QUnit.test( 'Test archetype mapping', assert => {

  assert.equal(
    PhetioIDUtils.getArchetypalPhetioID(
      'circuitConstructionKitDc.introScreen.model.circuit.batteryGroup.battery_0.powerDissipatedProperty.dependencies.circuitConstructionKitDc-introScreen-model-circuit-batteryGroup-battery_0-currentProperty' ),
    'circuitConstructionKitDc.introScreen.model.circuit.batteryGroup.archetype.powerDissipatedProperty.dependencies.circuitConstructionKitDc-introScreen-model-circuit-batteryGroup-archetype-currentProperty',
    'Unexpected phetioID' );

  assert.equal(
    PhetioIDUtils.getArchetypalPhetioID(
      'circuitConstructionKitDc.introScreen.model.circuit.batteryGroup.battery_0' ),
    'circuitConstructionKitDc.introScreen.model.circuit.batteryGroup.archetype',
    'Unexpected phetioID' );

  assert.equal(
    PhetioIDUtils.getArchetypalPhetioID(
      'circuitConstructionKitDc.introScreen.model.circuit.batteryGroup' ),
    'circuitConstructionKitDc.introScreen.model.circuit.batteryGroup',
    'Unexpected phetioID' );

  assert.equal(
    PhetioIDUtils.getArchetypalPhetioID(
      'circuitConstructionKitDc-introScreen-model-circuit-batteryGroup-battery_0-currentProperty' ),
    'circuitConstructionKitDc-introScreen-model-circuit-batteryGroup-archetype-currentProperty',
    'Unexpected phetioID' );

  assert.equal(
    PhetioIDUtils.getArchetypalPhetioID(
      'sim.circuitConstructionKitDc-introScreen-model-circuit-batteryGroup-battery_0-currentProperty.test.battery_1' ),
    'sim.circuitConstructionKitDc-introScreen-model-circuit-batteryGroup-archetype-currentProperty.test.archetype',
    'Unexpected phetioID' );

  assert.equal(
    PhetioIDUtils.getArchetypalPhetioID(
      'statesOfMatter.general.view.navigationBar.preferencesButton.preferencesDialogCapsule.preferencesDialog.selectedTabProperty' ),
    'statesOfMatter.general.view.navigationBar.preferencesButton.preferencesDialogCapsule.archetype.selectedTabProperty',
    'Unexpected phetioID' );

  assert.equal(
    PhetioIDUtils.getArchetypalPhetioID(
      'statesOfMatter.general.view.navigationBar.preferencesButton.aboutDialogCapsule.preferencesDialog' ),
    'statesOfMatter.general.view.navigationBar.preferencesButton.aboutDialogCapsule.archetype',
    'Unexpected phetioID' );

  assert.equal(
    PhetioIDUtils.getArchetypalPhetioID(
      'statesOfMatter.general.view.navigationBar.preferencesButton.aboutDialogCapsule' ),
    'statesOfMatter.general.view.navigationBar.preferencesButton.aboutDialogCapsule',
    'Unexpected phetioID' );

  assert.equal(
    PhetioIDUtils.getArchetypalPhetioID(
      'aboutDialogCapsule.preferencesDialog.somethingForTheMasses' ),
    'aboutDialogCapsule.archetype.somethingForTheMasses',
    'Unexpected phetioID' );

  assert.equal(
    PhetioIDUtils.getArchetypalPhetioID(
      'myGroup.myElement_foo.positionProperty' ),
    'myGroup.archetype.positionProperty',
    'Unexpected phetioID' );

  assert.equal(
    PhetioIDUtils.getArchetypalPhetioID(
      'myGroup.myElement_1.positionProperty' ),
    'myGroup.archetype.positionProperty',
    'Unexpected phetioID' );

  assert.equal(
    PhetioIDUtils.getArchetypalPhetioID(
      'myGroup.myElement_blarg2.positionProperty' ),
    'myGroup.archetype.positionProperty',
    'Unexpected phetioID' );
} );