// Copyright 2017-2025, University of Colorado Boulder

/**
 * Base type that provides PhET-iO features. An instrumented PhetioObject is referred to on the wrapper side/design side
 * as a "PhET-iO Element".  Note that sims may have hundreds or thousands of PhetioObjects, so performance and memory
 * considerations are important.  For this reason, initializePhetioObject is only called in PhET-iO brand, which means
 * many of the getters such as `phetioState` and `phetioDocumentation` will not work in other brands. We have opted
 * to have these getters throw assertion errors in other brands to help identify problems if these are called
 * unexpectedly.
 *
 * @author Sam Reid (PhET Interactive Simulations)
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import animationFrameTimer from '../../axon/js/animationFrameTimer.js';
import Disposable, { DisposableOptions } from '../../axon/js/Disposable.js';
import validate from '../../axon/js/validate.js';
import arrayRemove from '../../phet-core/js/arrayRemove.js';
import assertMutuallyExclusiveOptions from '../../phet-core/js/assertMutuallyExclusiveOptions.js';
import merge from '../../phet-core/js/merge.js';
import optionize, { combineOptions, EmptySelfOptions, OptionizeDefaults } from '../../phet-core/js/optionize.js';
import IntentionalAny from '../../phet-core/js/types/IntentionalAny.js';
import StrictOmit from '../../phet-core/js/types/StrictOmit.js';
import DescriptionRegistry from './DescriptionRegistry.js';
import EventType from './EventType.js';
import LinkedElementIO from './LinkedElementIO.js';
import { PhetioElementMetadata, PhetioID } from './phet-io-types.js';
import PhetioIDUtils from './PhetioIDUtils.js';
import Tandem from './Tandem.js';
import TandemConstants from './TandemConstants.js';
import tandemNamespace from './tandemNamespace.js';
import IOType, { AnyIOType } from './types/IOType.js';

// constants
const PHET_IO_ENABLED = Tandem.PHET_IO_ENABLED;
const IO_TYPE_VALIDATOR = { valueType: IOType, validationMessage: 'phetioType must be an IOType' };
const BOOLEAN_VALIDATOR = { valueType: 'boolean' };

// use "<br>" instead of newlines
const PHET_IO_DOCUMENTATION_VALIDATOR = {
  valueType: 'string',
  isValidValue: ( doc: string ) => !doc.includes( '\n' ),
  validationMessage: 'phetioDocumentation must be provided in the right format'
};
const PHET_IO_EVENT_TYPE_VALIDATOR = {
  valueType: EventType,
  validationMessage: 'invalid phetioEventType'
};
const OBJECT_VALIDATOR = { valueType: [ Object, null ] };

const objectToPhetioID = ( phetioObject: PhetioObject ) => phetioObject.tandem.phetioID;

type StartEventOptions = {
  data?: Record<string, IntentionalAny> | null;
  getData?: ( () => Record<string, IntentionalAny> ) | null;
};

// When an event is suppressed from the data stream, we keep track of it with this token.
const SKIPPING_MESSAGE = -1;

const ENABLE_DESCRIPTION_REGISTRY = !!window.phet?.chipper?.queryParameters?.supportsDescriptionPlugin;

const DEFAULTS: OptionizeDefaults<StrictOmit<SelfOptions, 'phetioDynamicElementName'>> = {

  tandem: Tandem.OPTIONAL,   // Subtypes can use `Tandem.REQUIRED` to require a named tandem passed in
  phetioType: IOType.ObjectIO,
  phetioDocumentation: TandemConstants.PHET_IO_OBJECT_METADATA_DEFAULTS.phetioDocumentation,
  phetioState: TandemConstants.PHET_IO_OBJECT_METADATA_DEFAULTS.phetioState,
  phetioReadOnly: TandemConstants.PHET_IO_OBJECT_METADATA_DEFAULTS.phetioReadOnly,
  phetioEventType: EventType.MODEL,
  phetioHighFrequency: TandemConstants.PHET_IO_OBJECT_METADATA_DEFAULTS.phetioHighFrequency,
  phetioPlayback: TandemConstants.PHET_IO_OBJECT_METADATA_DEFAULTS.phetioPlayback,
  phetioFeatured: TandemConstants.PHET_IO_OBJECT_METADATA_DEFAULTS.phetioFeatured,
  phetioDynamicElement: TandemConstants.PHET_IO_OBJECT_METADATA_DEFAULTS.phetioDynamicElement,
  phetioDesigned: TandemConstants.PHET_IO_OBJECT_METADATA_DEFAULTS.phetioDesigned,
  phetioEventMetadata: null,
  tandemNameSuffix: null,

  // @experimental - Defines description-specific tandems that do NOT affect the phet-io system.
  descriptionTandem: Tandem.OPTIONAL
};

// If you run into a type error here, feel free to add any type that is supported by the browsers "structured cloning algorithm" https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
type EventMetadata = Record<string, string | boolean | number | Array<string | boolean | number>>;

assert && assert( EventType.phetioType.toStateObject( DEFAULTS.phetioEventType ) === TandemConstants.PHET_IO_OBJECT_METADATA_DEFAULTS.phetioEventType,
  'phetioEventType must have the same default as the default metadata values.' );

// Options for creating a PhetioObject
type SelfOptions = StrictOmit<Partial<PhetioElementMetadata>, 'phetioTypeName' | 'phetioArchetypePhetioID' |
  'phetioIsArchetype' | 'phetioEventType'> & {

  // Unique identifier for this instance, used by PhET-iO to access this instance from the wrapper frame.
  // This is the only place in the project where `tandem` can be specified directly in a Type.
  tandem?: Tandem; // eslint-disable-line phet/bad-sim-text

  // @experimental - do not use without consulting https://github.com/phetsims/joist/issues/941
  descriptionTandem?: Tandem;

  // Defines API methods, events and serialization. The type of the PhET-iO Element, see IOType
  phetioType?: AnyIOType;

  // The category of event that this element emits to the PhET-iO Data Stream. This is a default, it can be overridden in
  // phetioStartEvent options.  Cannot be supplied through TandemConstants because that would create an import loop
  phetioEventType?: EventType;

  // delivered with each event, if specified. phetioPlayback is appended here, if true.
  // Note: unlike other options, this option can be mutated downstream, and hence should be created newly for each instance.
  phetioEventMetadata?: EventMetadata | null;

  // The element's tandem name must have a specified suffix. This is to enforce naming conventions for PhET-iO.
  // If string[] is provided, the tandem name must have a suffix that matches one of the strings in the array.
  // null means that there is no constraint on tandem name. The first character is not case-sensitive, to support
  // uses like 'thermometerNode' versus 'upperThermometerNode'.
  tandemNameSuffix?: string | string[] | null;
};
export type PhetioObjectOptions = SelfOptions & DisposableOptions;

type PhetioObjectMetadataKeys = keyof ( StrictOmit<PhetioElementMetadata, 'phetioTypeName' | 'phetioDynamicElementName'> ) | 'phetioType';

// A type that is used for the structural typing when gathering metadata. We just need a "PhetioObject-like" entity
// to pull the API metadata from. Thus, this is the "input" to logic that would pull the metadata keys into an object
// for the PhetioAPI.
// eslint-disable-next-line phet/phet-io-object-options-should-not-pick-from-phet-io-object
export type PhetioObjectMetadataInput = Pick<PhetioObject, PhetioObjectMetadataKeys>;

class PhetioObject extends Disposable {

  // assigned in initializePhetioObject - see docs at DEFAULTS declaration
  public tandem: Tandem;

  // track whether the object has been initialized.  This is necessary because initialization can happen in the
  // constructor or in a subsequent call to initializePhetioObject (to support scenery Node)
  private phetioObjectInitialized: boolean;

  // See documentation in DEFAULTS
  public phetioIsArchetype!: boolean;
  public phetioBaselineMetadata!: PhetioElementMetadata | null;
  private _phetioType!: AnyIOType;
  private _phetioState!: boolean;
  private _phetioReadOnly!: boolean;
  private _phetioDocumentation!: string;
  private _phetioEventType!: EventType;
  private _phetioHighFrequency!: boolean;
  private _phetioPlayback!: boolean;
  private _phetioDynamicElement!: boolean;
  private _phetioFeatured!: boolean;
  private _phetioEventMetadata!: EventMetadata | null;
  private _phetioDesigned!: boolean;

  // Public only for PhetioObjectMetadataInput
  public phetioArchetypePhetioID!: string | null;
  private linkedElements!: LinkedElement[] | null;
  public phetioNotifiedObjectCreated!: boolean;
  private phetioMessageStack!: number[];
  public static readonly DEFAULT_OPTIONS = DEFAULTS;
  public phetioID: PhetioID;

  public constructor( options?: PhetioObjectOptions ) {
    super();

    this.tandem = DEFAULTS.tandem;
    this.phetioID = this.tandem.phetioID;
    this.phetioObjectInitialized = false;

    if ( options ) {
      this.initializePhetioObject( {}, options );
    }
  }

  /**
   * Like SCENERY/Node, PhetioObject can be configured during construction or later with a mutate call.
   * Noop if provided options keys don't intersect with any key in DEFAULTS; baseOptions are ignored for this calculation.
   */
  protected initializePhetioObject( baseOptions: Partial<PhetioObjectOptions>, providedOptions: PhetioObjectOptions ): void {

    assert && assert( !baseOptions.hasOwnProperty( 'isDisposable' ), 'baseOptions should not contain isDisposable' );
    this.initializeDisposable( providedOptions );

    assert && assert( providedOptions, 'initializePhetioObject must be called with providedOptions' );

    // call before we exit early to support logging unsupplied Tandems.
    providedOptions.tandem && Tandem.onMissingTandem( providedOptions.tandem );

    // Make sure that required tandems are supplied
    if ( assert && Tandem.VALIDATION && providedOptions.tandem && providedOptions.tandem.required ) {
      assert( providedOptions.tandem.supplied, 'required tandems must be supplied' );
    }

    if ( ENABLE_DESCRIPTION_REGISTRY && providedOptions.tandem && providedOptions.tandem.supplied ) {
      DescriptionRegistry.add( providedOptions.tandem, this );
    }

    // The presence of `tandem` indicates if this PhetioObject can be initialized. If not yet initialized, perhaps
    // it will be initialized later on, as in Node.mutate().
    if ( !( PHET_IO_ENABLED && providedOptions.tandem && providedOptions.tandem.supplied ) ) {

      // In this case, the PhetioObject is not initialized, but still set tandem to maintain a consistent API for
      // creating the Tandem tree.
      if ( providedOptions.tandem ) {
        this.tandem = providedOptions.tandem;
        this.phetioID = this.tandem.phetioID;
      }
      return;
    }

    assert && assert( !this.phetioObjectInitialized, 'cannot initialize twice' );

    // Guard validation on assert to avoid calling a large number of no-ops when assertions are disabled, see https://github.com/phetsims/tandem/issues/200
    assert && validate( providedOptions.tandem, { valueType: Tandem } );

    const defaults = combineOptions<OptionizeDefaults<PhetioObjectOptions>>( {}, DEFAULTS, baseOptions );

    let options = optionize<PhetioObjectOptions>()( defaults, providedOptions );

    // validate options before assigning to properties
    assert && validate( options.phetioType, IO_TYPE_VALIDATOR );
    assert && validate( options.phetioState, merge( {}, BOOLEAN_VALIDATOR, { validationMessage: 'phetioState must be a boolean' } ) );
    assert && validate( options.phetioReadOnly, merge( {}, BOOLEAN_VALIDATOR, { validationMessage: 'phetioReadOnly must be a boolean' } ) );
    assert && validate( options.phetioEventType, PHET_IO_EVENT_TYPE_VALIDATOR );
    assert && validate( options.phetioDocumentation, PHET_IO_DOCUMENTATION_VALIDATOR );
    assert && validate( options.phetioHighFrequency, merge( {}, BOOLEAN_VALIDATOR, { validationMessage: 'phetioHighFrequency must be a boolean' } ) );
    assert && validate( options.phetioPlayback, merge( {}, BOOLEAN_VALIDATOR, { validationMessage: 'phetioPlayback must be a boolean' } ) );
    assert && validate( options.phetioFeatured, merge( {}, BOOLEAN_VALIDATOR, { validationMessage: 'phetioFeatured must be a boolean' } ) );
    assert && validate( options.phetioEventMetadata, merge( {}, OBJECT_VALIDATOR, { validationMessage: 'object literal expected' } ) );
    assert && validate( options.phetioDynamicElement, merge( {}, BOOLEAN_VALIDATOR, { validationMessage: 'phetioDynamicElement must be a boolean' } ) );
    assert && validate( options.phetioDesigned, merge( {}, BOOLEAN_VALIDATOR, { validationMessage: 'phetioDesigned must be a boolean' } ) );

    assert && assert( this.linkedElements !== null, 'this means addLinkedElement was called before instrumentation of this PhetioObject' );

    // optional - Indicates that an object is a archetype for a dynamic class. Settable only by
    // PhetioEngine and by classes that create dynamic elements when creating their archetype (like PhetioGroup) through
    // PhetioObject.markDynamicElementArchetype().
    // if true, items will be excluded from phetioState. This applies recursively automatically.
    this.phetioIsArchetype = false;

    // (phetioEngine)
    // Store the full baseline for usage in validation or for usage in studio.  Do this before applying overrides. The
    // baseline is created when a sim is run with assertions to assist in phetioAPIValidation.  However, even when
    // assertions are disabled, some wrappers such as studio need to generate the baseline anyway.
    // not all metadata are passed through via options, so store baseline for these additional properties
    this.phetioBaselineMetadata = ( Tandem.apiValidationEnabled || phet.preloads.phetio.queryParameters.phetioEmitAPIBaseline ) ?
                                  this.getMetadata( merge( {
                                    phetioIsArchetype: this.phetioIsArchetype,
                                    phetioArchetypePhetioID: this.phetioArchetypePhetioID
                                  }, options ) ) :
                                  null;

    // Dynamic elements should compare to their "archetypal" counterparts.  For example, this means that a Particle
    // in a PhetioGroup will take its overrides from the PhetioGroup archetype.
    const archetypalPhetioID = options.tandem.getArchetypalPhetioID();

    // Overrides are only defined for simulations, not for unit tests.  See https://github.com/phetsims/phet-io/issues/1461
    // Patch in the desired values from overrides, if any.
    if ( window.phet.preloads.phetio.phetioElementsOverrides ) {
      const overrides = window.phet.preloads.phetio.phetioElementsOverrides[ archetypalPhetioID ];
      if ( overrides ) {

        // No need to make a new object, since this "options" variable was created in the previous merge call above.
        options = optionize<PhetioObjectOptions>()( options, overrides );
      }
    }

    // (read-only) see docs at DEFAULTS declaration
    this.tandem = options.tandem!;
    this.phetioID = this.tandem.phetioID;

    // (read-only) see docs at DEFAULTS declaration
    this._phetioType = options.phetioType;

    // (read-only) see docs at DEFAULTS declaration
    this._phetioState = options.phetioState;

    // (read-only) see docs at DEFAULTS declaration
    this._phetioReadOnly = options.phetioReadOnly;

    // (read-only) see docs at DEFAULTS declaration
    this._phetioDocumentation = options.phetioDocumentation;

    // see docs at DEFAULTS declaration
    this._phetioEventType = options.phetioEventType;

    // see docs at DEFAULTS declaration
    this._phetioHighFrequency = options.phetioHighFrequency;

    // see docs at DEFAULTS declaration
    this._phetioPlayback = options.phetioPlayback;

    // (PhetioEngine) see docs at DEFAULTS declaration - in order to recursively pass this value to
    // children, the setPhetioDynamicElement() function must be used instead of setting this attribute directly
    this._phetioDynamicElement = options.phetioDynamicElement;

    // (read-only) see docs at DEFAULTS declaration
    this._phetioFeatured = options.phetioFeatured;

    this._phetioEventMetadata = options.phetioEventMetadata;

    this._phetioDesigned = options.phetioDesigned;

    // for phetioDynamicElements, the corresponding phetioID for the element in the archetype subtree
    this.phetioArchetypePhetioID = null;

    //keep track of LinkedElements for disposal. Null out to support asserting on
    // edge error cases, see this.addLinkedElement()
    this.linkedElements = [];

    // (phet-io) set to true when this PhetioObject has been sent over to the parent.
    this.phetioNotifiedObjectCreated = false;

    // tracks the indices of started messages so that dataStream can check that ends match starts.
    this.phetioMessageStack = [];

    // Make sure playback shows in the phetioEventMetadata
    if ( this._phetioPlayback ) {
      this._phetioEventMetadata = this._phetioEventMetadata || {};
      assert && assert( !this._phetioEventMetadata.hasOwnProperty( 'playback' ), 'phetioEventMetadata.playback should not already exist' );
      this._phetioEventMetadata.playback = true;
    }

    // Alert that this PhetioObject is ready for cross-frame communication (thus becoming a "PhET-iO Element" on the wrapper side.
    this.tandem.addPhetioObject( this );
    this.phetioObjectInitialized = true;

    if ( assert && Tandem.VALIDATION && this.isPhetioInstrumented() && options.tandemNameSuffix ) {

      const suffixArray = Array.isArray( options.tandemNameSuffix ) ? options.tandemNameSuffix : [ options.tandemNameSuffix ];
      const matches = suffixArray.filter( suffix => {
        return this.tandem.name.endsWith( suffix ) ||
               this.tandem.name.endsWith( PhetioObject.swapCaseOfFirstCharacter( suffix ) );
      } );
      assert && assert( matches.length > 0, 'Incorrect Tandem suffix, expected = ' + suffixArray.join( ', ' ) + '. actual = ' + this.tandem.phetioID );
    }
  }

  public static swapCaseOfFirstCharacter( string: string ): string {
    const firstChar = string[ 0 ];
    const newFirstChar = firstChar === firstChar.toLowerCase() ? firstChar.toUpperCase() : firstChar.toLowerCase();
    return newFirstChar + string.substring( 1 );
  }

  // throws an assertion error in brands other than PhET-iO
  public get phetioType(): AnyIOType {
    assert && assert( PHET_IO_ENABLED && this.isPhetioInstrumented(), 'phetioType only accessible for instrumented objects in PhET-iO brand.' );
    return this._phetioType;
  }

  // throws an assertion error in brands other than PhET-iO
  public get phetioState(): boolean {
    assert && assert( PHET_IO_ENABLED && this.isPhetioInstrumented(), 'phetioState only accessible for instrumented objects in PhET-iO brand.' );
    return this._phetioState;
  }

  // throws an assertion error in brands other than PhET-iO
  public get phetioReadOnly(): boolean {
    assert && assert( PHET_IO_ENABLED && this.isPhetioInstrumented(), 'phetioReadOnly only accessible for instrumented objects in PhET-iO brand.' );
    return this._phetioReadOnly;
  }

  // throws an assertion error in brands other than PhET-iO
  public get phetioDocumentation(): string {
    assert && assert( PHET_IO_ENABLED && this.isPhetioInstrumented(), 'phetioDocumentation only accessible for instrumented objects in PhET-iO brand.' );
    return this._phetioDocumentation;
  }

  // throws an assertion error in brands other than PhET-iO
  public get phetioEventType(): EventType {
    assert && assert( PHET_IO_ENABLED && this.isPhetioInstrumented(), 'phetioEventType only accessible for instrumented objects in PhET-iO brand.' );
    return this._phetioEventType;
  }

  // throws an assertion error in brands other than PhET-iO
  public get phetioHighFrequency(): boolean {
    assert && assert( PHET_IO_ENABLED && this.isPhetioInstrumented(), 'phetioHighFrequency only accessible for instrumented objects in PhET-iO brand.' );
    return this._phetioHighFrequency;
  }

  // throws an assertion error in brands other than PhET-iO
  public get phetioPlayback(): boolean {
    assert && assert( PHET_IO_ENABLED && this.isPhetioInstrumented(), 'phetioPlayback only accessible for instrumented objects in PhET-iO brand.' );
    return this._phetioPlayback;
  }

  // throws an assertion error in brands other than PhET-iO
  public get phetioDynamicElement(): boolean {
    assert && assert( PHET_IO_ENABLED && this.isPhetioInstrumented(), 'phetioDynamicElement only accessible for instrumented objects in PhET-iO brand.' );
    return this._phetioDynamicElement;
  }

  // throws an assertion error in brands other than PhET-iO
  public get phetioFeatured(): boolean {
    assert && assert( PHET_IO_ENABLED && this.isPhetioInstrumented(), 'phetioFeatured only accessible for instrumented objects in PhET-iO brand.' );
    return this._phetioFeatured;
  }

  // throws an assertion error in brands other than PhET-iO
  public get phetioEventMetadata(): EventMetadata | null {
    assert && assert( PHET_IO_ENABLED && this.isPhetioInstrumented(), 'phetioEventMetadata only accessible for instrumented objects in PhET-iO brand.' );
    return this._phetioEventMetadata;
  }

  // throws an assertion error in brands other than PhET-iO
  public get phetioDesigned(): boolean {
    assert && assert( PHET_IO_ENABLED && this.isPhetioInstrumented(), 'phetioDesigned only accessible for instrumented objects in PhET-iO brand.' );
    return this._phetioDesigned;
  }

  /**
   * Start an event for the nested PhET-iO data stream.
   *
   * @param event - the name of the event
   * @param [providedOptions]
   */
  public phetioStartEvent( event: string, providedOptions?: StartEventOptions ): void {
    if ( PHET_IO_ENABLED && this.isPhetioInstrumented() ) {

      // only one or the other can be provided
      assert && assertMutuallyExclusiveOptions( providedOptions, [ 'data' ], [ 'getData' ] );
      const options = optionize<StartEventOptions>()( {

        data: null,

        // function that, when called gets the data.
        getData: null
      }, providedOptions );

      assert && assert( this.phetioObjectInitialized, 'phetioObject should be initialized' );
      assert && options.data && assert( typeof options.data === 'object' );
      assert && options.getData && assert( typeof options.getData === 'function' );
      assert && assert( arguments.length === 1 || arguments.length === 2, 'Prevent usage of incorrect signature' );

      // TODO: don't drop PhET-iO events if they are created before we have a dataStream global. https://github.com/phetsims/phet-io/issues/1875
      if ( !_.hasIn( window, 'phet.phetio.dataStream' ) ) {

        // If you hit this, then it is likely related to https://github.com/phetsims/scenery/issues/1124 and we would like to know about it!
        // assert && assert( false, 'trying to create an event before the data stream exists' );

        this.phetioMessageStack.push( SKIPPING_MESSAGE );
        return;
      }

      // Opt out of certain events if queryParameter override is provided. Even for a low frequency data stream, high
      // frequency events can still be emitted when they have a low frequency ancestor.
      const skipHighFrequencyEvent = this.phetioHighFrequency &&
                                     _.hasIn( window, 'phet.preloads.phetio.queryParameters' ) &&
                                     !window.phet.preloads.phetio.queryParameters.phetioEmitHighFrequencyEvents &&
                                     !phet.phetio.dataStream.isEmittingLowFrequencyEvent();

      // TODO: If there is no dataStream global defined, then we should handle this differently as to not drop the event that is triggered, see https://github.com/phetsims/phet-io/issues/1846
      let skipFromUndefinedDatastream = !_.hasIn( window, 'phet.phetio.dataStream' );
      if ( assert ) {
        skipFromUndefinedDatastream = false;
      }

      if ( skipHighFrequencyEvent || this.phetioEventType === EventType.OPT_OUT || skipFromUndefinedDatastream ) {
        this.phetioMessageStack.push( SKIPPING_MESSAGE );
        return;
      }

      // Only get the args if we are actually going to send the event.
      const data = options.getData ? options.getData() : options.data;

      this.phetioMessageStack.push(
        phet.phetio.dataStream.start( this.phetioEventType, this.tandem.phetioID, this.phetioType, event, data, this.phetioEventMetadata, this.phetioHighFrequency )
      );

      // To support PhET-iO playback, any potential playback events downstream of this playback event must be marked as
      // non playback events. This is to prevent the PhET-iO playback engine from repeating those events. See
      // https://github.com/phetsims/phet-io/issues/1693
      this.phetioPlayback && phet.phetio.dataStream.pushNonPlaybackable();
    }
  }

  /**
   * End an event on the nested PhET-iO data stream. It this object was disposed or dataStream.start was not called,
   * this is a no-op.
   */
  public phetioEndEvent( assertCorrectIndices = false ): void {
    if ( PHET_IO_ENABLED && this.isPhetioInstrumented() ) {

      assert && assert( this.phetioMessageStack.length > 0, 'Must have messages to pop' );
      const topMessageIndex = this.phetioMessageStack.pop();

      // The message was started as a high frequency event to be skipped, so the end is a no-op
      if ( topMessageIndex === SKIPPING_MESSAGE ) {
        return;
      }
      this.phetioPlayback && phet.phetio.dataStream.popNonPlaybackable();
      phet.phetio.dataStream.end( topMessageIndex, assertCorrectIndices );
    }
  }

  /**
   * Set any instrumented descendants of this PhetioObject to the same value as this.phetioDynamicElement.
   */
  public propagateDynamicFlagsToDescendants(): void {
    assert && assert( Tandem.PHET_IO_ENABLED, 'phet-io should be enabled' );
    assert && assert( phet.phetio && phet.phetio.phetioEngine, 'Dynamic elements cannot be created statically before phetioEngine exists.' );
    const phetioEngine = phet.phetio.phetioEngine;

    // in the same order as bufferedPhetioObjects
    const unlaunchedPhetioIDs = !Tandem.launched ? Tandem.bufferedPhetioObjects.map( objectToPhetioID ) : [];

    this.tandem.iterateDescendants( tandem => {
      const phetioID = tandem.phetioID;

      if ( phetioEngine.hasPhetioObject( phetioID ) || ( !Tandem.launched && unlaunchedPhetioIDs.includes( phetioID ) ) ) {
        assert && assert( this.isPhetioInstrumented() );
        const phetioObject = phetioEngine.hasPhetioObject( phetioID ) ? phetioEngine.getPhetioElement( phetioID ) :
                             Tandem.bufferedPhetioObjects[ unlaunchedPhetioIDs.indexOf( phetioID ) ];

        assert && assert( phetioObject, 'should have a phetioObject here' );

        // Order matters here! The phetioIsArchetype needs to be first to ensure that the setPhetioDynamicElement
        // setter can opt out for archetypes.
        phetioObject.phetioIsArchetype = this.phetioIsArchetype;
        phetioObject.setPhetioDynamicElement( this.phetioDynamicElement );

        if ( phetioObject.phetioBaselineMetadata ) {
          phetioObject.phetioBaselineMetadata.phetioIsArchetype = this.phetioIsArchetype;
        }
      }
    } );
  }

  /**
   * Used in PhetioEngine
   */
  public setPhetioDynamicElement( phetioDynamicElement: boolean ): void {
    assert && assert( !this.phetioNotifiedObjectCreated, 'should not change dynamic element flags after notifying this PhetioObject\'s creation.' );
    assert && assert( this.isPhetioInstrumented() );

    // All archetypes are static (non-dynamic)
    this._phetioDynamicElement = this.phetioIsArchetype ? false : phetioDynamicElement;

    // For dynamic elements, indicate the corresponding archetype element so that clients like Studio can leverage
    // the archetype metadata. Static elements don't have archetypes.
    this.phetioArchetypePhetioID = phetioDynamicElement ? this.tandem.getArchetypalPhetioID() : null;

    // Keep the baseline metadata in sync.
    if ( this.phetioBaselineMetadata ) {
      this.phetioBaselineMetadata.phetioDynamicElement = this.phetioDynamicElement;
    }
  }

  /**
   * Mark this PhetioObject as an archetype for dynamic elements.
   */
  public markDynamicElementArchetype(): void {
    assert && assert( !this.phetioNotifiedObjectCreated, 'should not change dynamic element flags after notifying this PhetioObject\'s creation.' );

    this.phetioIsArchetype = true;
    this.setPhetioDynamicElement( false ); // because archetypes aren't dynamic elements

    if ( this.phetioBaselineMetadata ) {
      this.phetioBaselineMetadata.phetioIsArchetype = this.phetioIsArchetype;
    }

    // recompute for children also, but only if phet-io is enabled
    Tandem.PHET_IO_ENABLED && this.propagateDynamicFlagsToDescendants();
  }

  /**
   * A PhetioObject will only be instrumented if the tandem that was passed in was "supplied". See Tandem.supplied
   * for more info.
   */
  public isPhetioInstrumented(): boolean {
    return this.tandem && this.tandem.supplied;
  }

  /**
   * When an instrumented PhetioObject is linked with another instrumented PhetioObject, this creates a one-way
   * association which is rendered in Studio as a "symbolic" link or hyperlink. Many common code UI elements use this
   * automatically. To keep client sites simple, this has a graceful opt-out mechanism which makes this function a
   * no-op if either this PhetioObject or the target PhetioObject is not instrumented.
   *
   * You can specify the tandem one of three ways:
   * 1. Without specifying tandemName or tandem, it will pluck the tandem.name from the target element
   * 2. If tandemName is specified in the options, it will use that tandem name and nest the tandem under this PhetioObject's tandem
   * 3. If tandem is specified in the options (not recommended), it will use that tandem and nest it anywhere that tandem exists.
   *    Use this option with caution since it allows you to nest the tandem anywhere in the tree.
   *
   * @param element - the target element. Must be instrumented for a LinkedElement to be created-- otherwise gracefully opts out
   * @param [providedOptions]
   */
  public addLinkedElement( element: PhetioObject, providedOptions?: LinkedElementOptions ): void {
    if ( !this.isPhetioInstrumented() ) {

      // set this to null so that you can't addLinkedElement on an uninitialized PhetioObject and then instrument
      // it afterward.
      this.linkedElements = null;
      return;
    }

    // In some cases, UI components need to be wired up to a private (internal) Property which should neither be
    // instrumented nor linked.
    if ( PHET_IO_ENABLED && element.isPhetioInstrumented() ) {
      const options = optionize<LinkedElementOptions, EmptySelfOptions>()( {}, providedOptions );
      assert && assert( Array.isArray( this.linkedElements ), 'linkedElements should be an array' );

      let tandem: Tandem | null = null;
      if ( providedOptions && providedOptions.tandem ) {
        tandem = providedOptions.tandem;
      }
      else if ( providedOptions && providedOptions.tandemName ) {
        tandem = this.tandem.createTandem( providedOptions.tandemName );
      }
      else if ( !providedOptions && element.tandem ) {
        tandem = this.tandem.createTandem( element.tandem.name );
      }

      if ( tandem ) {
        options.tandem = tandem;
      }

      this.linkedElements!.push( new LinkedElement( element, options ) );
    }
  }

  /**
   * Remove all linked elements linking to the provided PhetioObject. This will dispose all removed LinkedElements. This
   * will be graceful, and doesn't assume or assert that the provided PhetioObject has LinkedElement(s), it will just
   * remove them if they are there.
   */
  public removeLinkedElements( potentiallyLinkedElement: PhetioObject ): void {
    if ( this.isPhetioInstrumented() && this.linkedElements ) {
      assert && assert( potentiallyLinkedElement.isPhetioInstrumented() );

      const toRemove = this.linkedElements.filter( linkedElement => linkedElement.element === potentiallyLinkedElement );
      toRemove.forEach( linkedElement => {
        linkedElement.dispose();
        arrayRemove( this.linkedElements!, linkedElement );
      } );
    }
  }

  /**
   * Performs cleanup after the sim's construction has finished.
   */
  public onSimulationConstructionCompleted(): void {

    // deletes the phetioBaselineMetadata, as it's no longer needed since validation is complete.
    this.phetioBaselineMetadata = null;
  }

  /**
   * Overrideable so that subclasses can return a different PhetioObject for studio autoselect. This method is called
   * when there is a scene graph hit. Return the corresponding target that matches the PhET-iO filters.  Note this means
   * that if PhET-iO Studio is looking for a featured item and this is not featured, it will return 'phetioNotSelectable'.
   * Something is 'phetioNotSelectable' if it is not instrumented or if it does not match the "featured" filtering.
   *
   * The `fromLinking` flag allows a cutoff to prevent recursive linking chains in 'linked' mode. Given these linked elements:
   * cardNode -> card -> cardValueProperty
   * We don't want 'linked' mode to map from cardNode all the way to cardValueProperty (at least automatically), see https://github.com/phetsims/tandem/issues/300
   */
  public getPhetioMouseHitTarget( fromLinking = false ): PhetioObject | 'phetioNotSelectable' {
    assert && assert( phet.tandem.phetioElementSelectionProperty.value !== 'none', 'getPhetioMouseHitTarget should not be called when phetioElementSelectionProperty is none' );

    // Don't get a linked element for a linked element (recursive link element searching)
    if ( !fromLinking && phet.tandem.phetioElementSelectionProperty.value === 'linked' ) {
      const linkedElement = this.getCorrespondingLinkedElement();
      if ( linkedElement !== 'noCorrespondingLinkedElement' ) {
        return linkedElement.getPhetioMouseHitTarget( true );
      }
      else if ( this.tandem.parentTandem ) {
        // Look for a sibling linkedElement if there are no child linkages, see https://github.com/phetsims/studio/issues/246#issuecomment-1018733408

        const parent: PhetioObject | undefined = phet.phetio.phetioEngine.phetioElementMap[ this.tandem.parentTandem.phetioID ];
        if ( parent ) {
          const linkedParentElement = parent.getCorrespondingLinkedElement();
          if ( linkedParentElement !== 'noCorrespondingLinkedElement' ) {
            return linkedParentElement.getPhetioMouseHitTarget( true );
          }
        }
      }

      // Otherwise fall back to the view element, don't return here
    }

    if ( phet.tandem.phetioElementSelectionProperty.value === 'string' ) {
      return 'phetioNotSelectable';
    }

    return this.getPhetioMouseHitTargetSelf();
  }

  /**
   * Determine if this instance should be selectable
   */
  protected getPhetioMouseHitTargetSelf(): PhetioObject | 'phetioNotSelectable' {
    return this.isPhetioMouseHitSelectable() ? this : 'phetioNotSelectable';
  }

  /**
   * Factored out function returning if this instance is phetio selectable
   */
  private isPhetioMouseHitSelectable(): boolean {

    // We are not selectable if we are unfeatured and we are only displaying featured elements.
    // To prevent a circular dependency. We need to have a Property (which is a PhetioObject) in order to use it.
    // This should remain a hard failure if we have not loaded this display Property by the time we want a mouse-hit target.
    const featuredFilterCorrect = phet.tandem.phetioElementsDisplayProperty.value !== 'featured' || this.isDisplayedInFeaturedTree();

    return this.isPhetioInstrumented() && featuredFilterCorrect;
  }

  /**
   * This function determines not only if this PhetioObject is phetioFeatured, but if any descendant of this
   * PhetioObject is phetioFeatured, this will influence if this instance is displayed while showing phetioFeatured,
   * since featured children will cause the parent to be displayed as well.
   */
  private isDisplayedInFeaturedTree(): boolean {
    if ( this.isPhetioInstrumented() && this.phetioFeatured ) {
      return true;
    }
    let displayed = false;
    this.tandem.iterateDescendants( descendantTandem => {
      const parent: PhetioObject | undefined = phet.phetio.phetioEngine.phetioElementMap[ descendantTandem.phetioID ];
      if ( parent && parent.isPhetioInstrumented() && parent.phetioFeatured ) {
        displayed = true;
      }
    } );
    return displayed;
  }

  /**
   * Acquire the linkedElement that most closely relates to this PhetioObject, given some heuristics. First, if there is
   * only a single LinkedElement child, use that. Otherwise, select hard coded names that are likely to be most important.
   */
  public getCorrespondingLinkedElement(): PhetioObject | 'noCorrespondingLinkedElement' {
    const children = Object.keys( this.tandem.children );
    const linkedChildren: LinkedElement[] = [];
    children.forEach( childName => {
      const childPhetioID = PhetioIDUtils.append( this.tandem.phetioID, childName );

      // Note that if it doesn't find a phetioID, that may be a synthetic node with children but not itself instrumented.
      const phetioObject: PhetioObject | undefined = phet.phetio.phetioEngine.phetioElementMap[ childPhetioID ];
      if ( phetioObject instanceof LinkedElement ) {
        linkedChildren.push( phetioObject );
      }
    } );
    const linkedTandemNames = linkedChildren.map( ( linkedElement: LinkedElement ): string => {
      return PhetioIDUtils.getComponentName( linkedElement.phetioID );
    } );
    let linkedChild: LinkedElement | null = null;
    if ( linkedChildren.length === 1 ) {
      linkedChild = linkedChildren[ 0 ];
    }
    else if ( linkedTandemNames.includes( 'property' ) ) {

      // Prioritize a linked child named "property"
      linkedChild = linkedChildren[ linkedTandemNames.indexOf( 'property' ) ];
    }
    else if ( linkedTandemNames.includes( 'valueProperty' ) ) {

      // Next prioritize "valueProperty", a common name for the controlling Property of a view component
      linkedChild = linkedChildren[ linkedTandemNames.indexOf( 'valueProperty' ) ];
    }
    else {

      // Either there are no linked children, or too many to know which one to select.
      return 'noCorrespondingLinkedElement';
    }

    assert && assert( linkedChild, 'phetioElement is needed' );
    return linkedChild.element;
  }

  /**
   * Remove this phetioObject from PhET-iO. After disposal, this object is no longer interoperable. Also release any
   * other references created during its lifetime.
   *
   * In order to support the structured data stream, PhetioObjects must end the messages in the correct
   * sequence, without being interrupted by dispose() calls.  Therefore, we do not clear out any of the state
   * related to the endEvent.  Note this means it is acceptable (and expected) for endEvent() to be called on
   * disposed PhetioObjects.
   */
  public override dispose(): void {

    // The phetioEvent stack should resolve by the next frame, so that's when we check it.
    if ( assert && Tandem.PHET_IO_ENABLED && this.tandem.supplied ) {

      const descendants: PhetioObject[] = [];
      this.tandem.iterateDescendants( tandem => {
        if ( phet.phetio.phetioEngine.hasPhetioObject( tandem.phetioID ) ) {
          descendants.push( phet.phetio.phetioEngine.getPhetioElement( tandem.phetioID ) );
        }
      } );

      animationFrameTimer.runOnNextTick( () => {

        // Uninstrumented PhetioObjects don't have a phetioMessageStack attribute.
        assert && assert( !this.hasOwnProperty( 'phetioMessageStack' ) || this.phetioMessageStack.length === 0,
          'phetioMessageStack should be clear' );

        descendants.forEach( descendant => {
          assert && assert( descendant.isDisposed, `All descendants must be disposed by the next frame: ${descendant.tandem.phetioID}` );
        } );
      } );
    }

    if ( ENABLE_DESCRIPTION_REGISTRY && this.tandem && this.tandem.supplied ) {
      DescriptionRegistry.remove( this );
    }

    // Detach from listeners and dispose the corresponding tandem. This must happen in PhET-iO brand and PhET brand
    // because in PhET brand, PhetioDynamicElementContainer dynamic elements would memory leak tandems (parent tandems
    // would retain references to their children).
    this.tandem.removePhetioObject( this );

    // Dispose LinkedElements
    if ( this.linkedElements ) {
      this.linkedElements.forEach( linkedElement => linkedElement.dispose() );
      this.linkedElements.length = 0;
    }

    super.dispose();
  }

  /**
   * JSONifiable metadata that describes the nature of the PhetioObject.  We must be able to read this
   * for baseline (before object fully constructed we use object) and after fully constructed
   * which includes overrides.
   * @param [object] - used to get metadata keys, can be a PhetioObject, or an options object
   *                          (see usage initializePhetioObject). If not provided, will instead use the value of "this"
   * @returns - metadata plucked from the passed in parameter
   */
  public getMetadata( object?: PhetioObjectMetadataInput ): PhetioElementMetadata {
    object = object || this;
    const metadata: PhetioElementMetadata = {
      phetioTypeName: object.phetioType.typeName,
      phetioDocumentation: object.phetioDocumentation,
      phetioState: object.phetioState,
      phetioReadOnly: object.phetioReadOnly,
      phetioEventType: EventType.phetioType.toStateObject( object.phetioEventType ),
      phetioHighFrequency: object.phetioHighFrequency,
      phetioPlayback: object.phetioPlayback,
      phetioDynamicElement: object.phetioDynamicElement,
      phetioIsArchetype: object.phetioIsArchetype,
      phetioFeatured: object.phetioFeatured,
      phetioDesigned: object.phetioDesigned
    };
    if ( object.phetioArchetypePhetioID ) {

      metadata.phetioArchetypePhetioID = object.phetioArchetypePhetioID;
    }
    return metadata;
  }

  // Public facing documentation, no need to include metadata that may we don't want clients knowing about
  public static readonly METADATA_DOCUMENTATION = 'Get metadata about the PhET-iO Element. This includes the following keys:<ul>' +
                                                  '<li><strong>phetioTypeName:</strong> The name of the PhET-iO Type\n</li>' +
                                                  '<li><strong>phetioDocumentation:</strong> default - null. Useful notes about a PhET-iO Element, shown in the PhET-iO Studio Wrapper</li>' +
                                                  '<li><strong>phetioState:</strong> default - true. When true, includes the PhET-iO Element in the PhET-iO state\n</li>' +
                                                  '<li><strong>phetioReadOnly:</strong> default - false. When true, you can only get values from the PhET-iO Element; no setting allowed.\n</li>' +
                                                  '<li><strong>phetioEventType:</strong> default - MODEL. The category of event that this element emits to the PhET-iO Data Stream.\n</li>' +
                                                  '<li><strong>phetioDynamicElement:</strong> default - false. If this element is a "dynamic element" that can be created and destroyed throughout the lifetime of the sim (as opposed to existing forever).\n</li>' +
                                                  '<li><strong>phetioIsArchetype:</strong> default - false. If this element is an archetype for a dynamic element.\n</li>' +
                                                  '<li><strong>phetioFeatured:</strong> default - false. If this is a featured PhET-iO Element.\n</li>' +
                                                  '<li><strong>phetioArchetypePhetioID:</strong> default - \'\'. If an applicable dynamic element, this is the phetioID of its archetype.\n</li></ul>';


  public static create( options?: PhetioObjectOptions ): PhetioObject {
    return new PhetioObject( options );
  }
}

// See documentation for addLinkedElement() to describe how to instrument LinkedElements. No other metadata is needed
// for LinkedElements, and should instead be provided to the coreElement. If you find a case where you want to pass
// another option through, please discuss with your friendly, neighborhood PhET-iO developer.
type LinkedElementOptions = ( { tandemName?: string; tandem?: never } | { tandemName?: never; tandem?: Tandem } ) & {
  phetioFeatured?: boolean;
};

/**
 * Internal class to avoid cyclic dependencies.
 */
class LinkedElement extends PhetioObject {
  public readonly element: PhetioObject;

  public constructor( coreElement: PhetioObject, providedOptions?: LinkedElementOptions ) {
    assert && assert( !!coreElement, 'coreElement should be defined' );

    const options = optionize<LinkedElementOptions, EmptySelfOptions, PhetioObjectOptions>()( {
      phetioType: LinkedElementIO,
      phetioState: true,

      // By default, LinkedElements are as featured as their coreElements are.
      phetioFeatured: coreElement.phetioFeatured
    }, providedOptions );

    // References cannot be changed by PhET-iO
    assert && assert( !options.hasOwnProperty( 'phetioReadOnly' ), 'phetioReadOnly set by LinkedElement' );
    options.phetioReadOnly = true;

    super( options );

    this.element = coreElement;
  }
}

tandemNamespace.register( 'PhetioObject', PhetioObject );
export { PhetioObject as default, LinkedElement };