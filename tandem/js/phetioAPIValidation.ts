// Copyright 2019-2025, University of Colorado Boulder

/**
 * This singleton is responsible for ensuring that the PhET-iO API is correct through the lifetime of the simulation.
 * The PhET-iO API is defined through multiple preloaded files. The "elements baseline" API holds an exact match of
 * what PhetioObject instances/metadata the sim should create on startup, where the "elements overrides" file is a
 * sparse list that can overwrite metadata without changing the code. See `grunt generate-phet-io-api` for
 * more information. The complete list of checks was decided on in https://github.com/phetsims/phet-io/issues/1453
 * (and later trimmed down) and is as follows:
 *
 * 1. After startup, only dynamic instances prescribed by the baseline API can be registered.
 * 2. Any static, registered PhetioObject can never be deregistered.
 * 3. Any schema entries in the overrides file must exist in the baseline API
 * 4. Any schema entries in the overrides file must be different from its baseline counterpart
 * 5. Dynamic element metadata should match the archetype in the API.
 * 6. All entries in the API should be instrumented (no usages of optional/requiredTandem as phetioIDs)
 *
 * Terminology:
 * schema: specified through preloads. The full schema is the baseline plus the overrides, but those parts can be
 *         referred to separately.
 * registered: the process of instrumenting a PhetioObject and it "becoming" a PhET-iO Element on the wrapper side.
 * static PhetioObject: A registered PhetioObject that exists for the lifetime of the sim. It should not be removed
 *                      (even intermittently) and must be created during startup so that it is immediately interoperable.
 * dynamic PhetioObject: A registered PhetioObject that can be created and/or destroyed at any point. Only dynamic
 *                       PhetioObjects can be created after startup.
 *
 * See https://github.com/phetsims/phet-io/issues/1443#issuecomment-484306552 for an explanation of how to maintain the
 * PhET-iO API for a simulation.
 *
 * @author Sam Reid (PhET Interactive Simulations)
 * @author Michael Kauzmann (PhET Interactive Simulations)
 * @author Chris Klusendorf (PhET Interactive Simulations)
 */

import animationFrameTimer from '../../axon/js/animationFrameTimer.js';
import { PhetioAPI, PhetioElementMetadata, PhetioID } from './phet-io-types.js';
import type PhetioObject from './PhetioObject.js';
import { LinkedElement } from './PhetioObject.js';
import Tandem, { DYNAMIC_ARCHETYPE_NAME } from './Tandem.js';
import tandemNamespace from './tandemNamespace.js';
import { AnyIOType } from './types/IOType.js';

// constants
// The API-tracked and validated metadata keys
const KEYS_TO_CHECK = [
  'phetioDynamicElement',
  'phetioEventType',
  'phetioIsArchetype',
  'phetioPlayback',
  'phetioReadOnly',
  'phetioState',
  'phetioTypeName'
];

// Feel free to add any other JSONifyable keys to this to make the error more clear! All mismatches are printed
// at once for clarity, see PhetioEngine.
type APIMismatch = {
  phetioID: PhetioID;
  ruleInViolation: string; // one of the numbered list in the header doc.
  message?: string; // specific problem
  source?: string;
};

class PhetioAPIValidation {
  private readonly apiMismatches: APIMismatch[] = [];

  // keep track of when the sim has started.
  private simHasStarted = false;

  // this must be all phet-io types so that the
  // following would fail: add a phetioType, then remove it, then add a different one under the same typeName.
  // A Note about memory: Every IOType that is loaded as a module is already loaded on the namespace. Therefore
  // this map doesn't add any memory by storing these. The exception to this is parametric IOTypes. It should be
  // double checked that anything being passed into a parametric type is memory safe. As of this writing, only IOTypes
  // are passed to parametric IOTypes, so this pattern remains memory leak free. Furthermore, this list is only
  // populated when `Tandem.apiValidationEnabled`.
  private everyPhetioType: Record<string, AnyIOType> = {};

  /**
   * Callback when the simulation is ready to go, and all static PhetioObjects have been created.
   */
  public onSimStarted(): void {
    if ( Tandem.apiValidationEnabled && phet.joist.sim.allScreensCreated ) {
      this.validateOverridesFile();
      this.validatePreferencesModel();
    }

    if ( phet.preloads.phetio.queryParameters.phetioPrintAPIProblems && this.apiMismatches ) {
      console.log( 'PhET-iO API problems detected: ', this.apiMismatches );
    }

    // After the overrides validation to support ?phetioPrintAPIProblems on errors with overrides.
    this.simHasStarted = true;
  }

  /**
   * All core elements in the preferencesModel should be phetioReadOnly: false so they can be set over the API
   * or from within studio, but phetioState: false so they are not captured with save states.
   */
  public validatePreferencesModel(): void {
    Object.keys( phet.phetio.phetioEngine.phetioElementMap ).filter( key => key.includes( '.preferencesModel.' ) )
      .forEach( preferencesKey => {

        let phetioObject = phet.phetio.phetioEngine.phetioElementMap[ preferencesKey ];

        while ( phetioObject instanceof LinkedElement ) {
          phetioObject = phetioObject.element;
        }
        assert && assert( !phetioObject.phetioReadOnly, 'preferences model and its descendants should be phetioReadOnly: false, key=' + preferencesKey );

        // Audio manager, color profile property and localeProperty are supposed to be stateful. All other preferences
        // should be phetioState: false so they are not captured in the state
        assert && assert( phetioObject.phetioState ===
                          ( phetioObject.phetioID.endsWith( '.colorProfileProperty' ) ||
                            phetioObject.phetioID.endsWith( '.audioEnabledProperty' ) ||
                            phetioObject.phetioID.endsWith( '.localeProperty' ) ||

                            // Sim preferences should also be stateful
                            preferencesKey.includes( '.simulationModel.' ) ),
          'most preferences should be phetioState: false, key=' + preferencesKey );
      } );
  }

  // Validation checks that can be made on the API JSON object directly
  public validateFullAPI( api: PhetioAPI ): void {
    if ( Tandem.apiValidationEnabled ) {
      const string = JSON.stringify( api );
      [ Tandem.OPTIONAL.name, Tandem.REQUIRED.name ].forEach( name => {
        if ( string.includes( name ) ) {
          this.assertAPIError( {
            phetioID: name,
            ruleInViolation: '6. All entries in the API should be instrumented (no usages of optional/requiredTandem as phetioIDs)'
          } );
        }
      } );
    }
  }

  /**
   * Checks if a removed phetioObject is part of a Group
   */
  public onPhetioObjectRemoved( phetioObject: PhetioObject ): void {
    if ( !Tandem.apiValidationEnabled ) {
      return;
    }

    const phetioID = phetioObject.tandem.phetioID;

    // if it isn't dynamic, then it shouldn't be removed during the lifetime of the sim.
    if ( !phetioObject.phetioDynamicElement ) {
      this.assertAPIError( {
        phetioID: phetioID,
        ruleInViolation: '2. Any static, registered PhetioObject can never be deregistered.'
      } );
    }
  }

  /**
   * Should be called from phetioEngine when a PhetioObject is added to the PhET-iO
   */
  public onPhetioObjectAdded( phetioObject: PhetioObject ): void {
    if ( !Tandem.apiValidationEnabled ) {
      return;
    }

    const newPhetioType = phetioObject.phetioType;
    const oldPhetioType = this.everyPhetioType[ newPhetioType.typeName ];

    if ( !oldPhetioType ) { // This may not be necessary, but may be helpful so that we don't overwrite if rule 10 is in violation
      this.everyPhetioType[ newPhetioType.typeName ] = newPhetioType;
    }

    if ( this.simHasStarted ) {

      // Here we need to kick this validation to the next frame to support construction in any order. Parent first, or
      // child first. Use namespace to avoid because timer is a PhetioObject.
      animationFrameTimer.runOnNextTick( () => {

        // The only instances that it's OK to create after startup are "dynamic instances" which are marked as such.
        if ( !phetioObject.phetioDynamicElement ) {
          this.assertAPIError( {
            phetioID: phetioObject.tandem.phetioID,
            ruleInViolation: '1. After startup, only dynamic instances prescribed by the baseline file can be registered.'
          } );
        }
        else {

          // Compare the dynamic element to the archetype if creating them this runtime. Don't check this if it has
          // already been disposed.
          if ( phet.preloads.phetio.createArchetypes && !phetioObject.isDisposed ) {
            const archetypeID = phetioObject.tandem.getArchetypalPhetioID();
            const archetypeMetadata = phet.phetio.phetioEngine.getPhetioElement( archetypeID ).getMetadata();

            // Compare to the simulation-defined archetype
            this.checkDynamicInstanceAgainstArchetype( phetioObject, archetypeMetadata, 'simulation archetype' );
          }
        }
      } );
    }
  }

  private validateOverridesFile(): void {

    // import phetioEngine causes a cycle and cannot be used, hence we must use the namespace
    const entireBaseline = phet.phetio.phetioEngine.getPhetioElementsBaseline();

    for ( const phetioID in window.phet.preloads.phetio.phetioElementsOverrides ) {
      const isArchetype = phetioID.includes( DYNAMIC_ARCHETYPE_NAME );
      if ( !phet.preloads.phetio.createArchetypes && !entireBaseline.hasOwnProperty( phetioID ) ) {
        assert && assert( isArchetype, `phetioID missing from the baseline that was not an archetype: ${phetioID}` );
      }
      else {
        if ( !entireBaseline.hasOwnProperty( phetioID ) ) {
          this.assertAPIError( {
            phetioID: phetioID,
            ruleInViolation: '3. Any schema entries in the overrides file must exist in the baseline file.',
            message: 'phetioID expected in the baseline file but does not exist'
          } );
        }
        else {

          const override = window.phet.preloads.phetio.phetioElementsOverrides[ phetioID ];
          const baseline = entireBaseline[ phetioID ];

          if ( Object.keys( override ).length === 0 ) {
            this.assertAPIError( {
              phetioID: phetioID,
              ruleInViolation: '4. Any schema entries in the overrides file must be different from its baseline counterpart.',
              message: 'no metadata keys found for this override.'
            } );
          }

          for ( const metadataKey in override ) {
            if ( !baseline.hasOwnProperty( metadataKey ) ) {
              this.assertAPIError( {
                phetioID: phetioID,
                ruleInViolation: '8. Any schema entries in the overrides file must be different from its baseline counterpart.',
                message: `phetioID metadata key not found in the baseline: ${metadataKey}`
              } );
            }

            if ( override[ metadataKey ] === baseline[ metadataKey ] ) {
              this.assertAPIError( {
                phetioID: phetioID,
                ruleInViolation: '8. Any schema entries in the overrides file must be different from its baseline counterpart.',
                message: 'phetioID metadata override value is the same as the corresponding metadata value in the baseline.'
              } );
            }
          }
        }
      }
    }
  }

  /**
   * Assert out the failed API validation rule.
   */
  private assertAPIError( apiErrorObject: APIMismatch ): void {

    const mismatchMessage = apiErrorObject.phetioID ? `${apiErrorObject.phetioID}:  ${apiErrorObject.ruleInViolation}` :
                            `${apiErrorObject.ruleInViolation}`;

    this.apiMismatches.push( apiErrorObject );

    // If ?phetioPrintAPIProblems is present, then ignore assertions until the sim has started up.
    if ( this.simHasStarted || !phet.preloads.phetio.queryParameters.phetioPrintAPIProblems ) {
      if ( phet.preloads.phetio.queryParameters.phetioPrintAPIProblems ) {
        console.error( 'API Problems:', this.apiMismatches );
      }
      else {
        assert && assert( false, `PhET-iO API error:\n${mismatchMessage}` );
      }
    }
  }


  /**
   * Compare a dynamic phetioObject's metadata to the expected metadata
   */
  private checkDynamicInstanceAgainstArchetype( phetioObject: PhetioObject, archetypeMetadata: PhetioElementMetadata, source: string ): void {
    const actualMetadata = phetioObject.getMetadata();
    KEYS_TO_CHECK.forEach( key => {

      // These attributes are different for archetype vs actual
      if ( key !== 'phetioDynamicElement' && key !== 'phetioArchetypePhetioID' && key !== 'phetioIsArchetype' ) {

        // @ts-expect-error - not sure how to be typesafe in the API files
        if ( archetypeMetadata[ key ] !== actualMetadata[ key ] && phetioObject.tandem ) {
          this.assertAPIError( {
            phetioID: phetioObject.tandem.phetioID,
            ruleInViolation: '5. Dynamic element metadata should match the archetype in the API.',
            source: source,
            message: `mismatched metadata: ${key}`
          } );
        }
      }
    } );
  }
}


const phetioAPIValidation = new PhetioAPIValidation();
tandemNamespace.register( 'phetioAPIValidation', phetioAPIValidation );
export default phetioAPIValidation;