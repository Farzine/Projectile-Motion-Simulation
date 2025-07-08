// Copyright 2015-2025, University of Colorado Boulder

/**
 * Tandem defines a set of trees that are used to assign unique identifiers to PhetioObjects in PhET simulations and
 * notify listeners when the associated PhetioObjects have been added/removed. It is used to support PhET-iO.
 *
 * @author Sam Reid (PhET Interactive Simulations)
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import arrayRemove from '../../phet-core/js/arrayRemove.js';
import isPhetioEnabled from '../../phet-core/js/isPhetioEnabled.js';
import merge from '../../phet-core/js/merge.js';
import optionize from '../../phet-core/js/optionize.js';
import { QueryStringMachine } from '../../query-string-machine/js/QueryStringMachineModule.js';
import { PhetioID } from './phet-io-types.js';
import PhetioIDUtils from './PhetioIDUtils.js';
import type PhetioObject from './PhetioObject.js';
import TandemConstants from './TandemConstants.js';
import tandemNamespace from './tandemNamespace.js';

// constants
// Tandem can't depend on joist, so cannot use packageJSON module
const packageJSON = _.hasIn( window, 'phet.chipper.packageObject' ) ? phet.chipper.packageObject : { name: 'placeholder' };

const PHET_IO_ENABLED = isPhetioEnabled;
const PRINT_MISSING_TANDEMS = PHET_IO_ENABLED && phet.preloads.phetio.queryParameters.phetioPrintMissingTandems;

// Validation defaults to true, but can be overridden to be false in package.json.
const IS_VALIDATION_DEFAULT = _.hasIn( packageJSON, 'phet.phet-io.validation' ) ? !!packageJSON.phet[ 'phet-io' ].validation : true;

// The default value for validation can be overridden with a query parameter ?phetioValidation={true|false}.
const IS_VALIDATION_QUERY_PARAMETER_SPECIFIED = QueryStringMachine.containsKey( 'phetioValidation' );
const IS_VALIDATION_SPECIFIED = ( PHET_IO_ENABLED && IS_VALIDATION_QUERY_PARAMETER_SPECIFIED ) ? !!phet.preloads.phetio.queryParameters.phetioValidation :
                                ( PHET_IO_ENABLED && IS_VALIDATION_DEFAULT );

const VALIDATION = PHET_IO_ENABLED && IS_VALIDATION_SPECIFIED && !PRINT_MISSING_TANDEMS;

const UNALLOWED_TANDEM_NAMES = [
  'pickableProperty', // use inputEnabled instead

  // in https://github.com/phetsims/phet-io/issues/1915 we decided to prefer the scenery listener types
  // ('dragListener' etc). If you encounter this and feel like inputListener is preferable, let's discuss!
  'inputListener',
  'dragHandler' // prefer dragListener
];

const REQUIRED_TANDEM_NAME = 'requiredTandem';
const OPTIONAL_TANDEM_NAME = 'optionalTandem';

const FORBIDDEN_SUPPLIED_TANDEM_NAMES = [
  REQUIRED_TANDEM_NAME,
  OPTIONAL_TANDEM_NAME
];

const TEST_TANDEM_NAME = 'test';
const INTER_TERM_SEPARATOR = PhetioIDUtils.INTER_TERM_SEPARATOR;
export const DYNAMIC_ARCHETYPE_NAME = PhetioIDUtils.ARCHETYPE;

// Workaround for how we are stripping assertions. Separated out the if ( assert ).
let assertEnabled = false;
if ( assert ) {
  assertEnabled = true;
}

// used to keep track of missing tandems
const missingTandems: {
  required: Array<{ phetioID: PhetioID; stack: string }>;
  optional: Array<{ phetioID: PhetioID; stack: string }>;
} = {
  required: [],
  optional: []
};

type PhetioObjectListener = {
  addPhetioObject: ( phetioObject: PhetioObject ) => void;
  removePhetioObject: ( phetioObject: PhetioObject ) => void;
};

// Listeners that will be notified when items are registered/deregistered. See doc in addPhetioObjectListener
const phetioObjectListeners: Array<PhetioObjectListener> = [];

// keep track of listeners to fire when Tandem.launch() is called.
const launchListeners: Array<() => void> = [];

export type TandemOptions = {
  required?: boolean;
  supplied?: boolean;
  isValidTandemName?: ( name: string ) => boolean;
};

class Tandem {

  // Treat as readonly.  Only marked as writable so it can be eliminated on dispose
  public parentTandem: Tandem | null;

  // the last part of the tandem (after the last .), used e.g., in Joist for creating button
  // names dynamically based on screen names
  public readonly name: string;
  public readonly phetioID: PhetioID;

  // phet-io internal, please don't use this. Please.
  public readonly children: Record<string, Tandem> = {};
  public readonly required: boolean;
  public readonly supplied: boolean;
  private isDisposed = false;

  public static readonly SCREEN_TANDEM_NAME_SUFFIX = 'Screen';

  /**
   * Typically, sims will create tandems using `tandem.createTandem`.  This constructor is used internally or when
   * a tandem must be created from scratch.
   *
   * @param parentTandem - parent for a child tandem, or null for a root tandem
   * @param name - component name for this level, like 'resetAllButton'
   * @param [providedOptions]
   */
  public constructor( parentTandem: Tandem | null, name: string, providedOptions?: TandemOptions ) {
    assert && assert( parentTandem === null || parentTandem instanceof Tandem, 'parentTandem should be null or Tandem' );
    assert && assert( name !== Tandem.METADATA_KEY, 'name cannot match Tandem.METADATA_KEY' );

    this.parentTandem = parentTandem;
    this.name = name;

    this.phetioID = this.parentTandem ? PhetioIDUtils.append( this.parentTandem.phetioID, this.name )
                                      : this.name;

    // options (even subtype options) must be stored so they can be passed through to children
    // Note: Make sure that added options here are also added to options for inheritance and/or for composition
    // (createTandem/parentTandem/getExtendedOptions) as appropriate.
    const options = optionize<TandemOptions>()( {

      // required === false means it is an optional tandem
      required: true,

      // if the tandem is required but not supplied, an error will be thrown.
      supplied: true,

      isValidTandemName: ( name: string ) => Tandem.getRegexFromCharacterClass().test( name )
    }, providedOptions );

    assert && assert( options.isValidTandemName( name ), `invalid tandem name: ${name}` );

    assert && assert( !options.supplied || FORBIDDEN_SUPPLIED_TANDEM_NAMES.every( forbiddenName => !name.includes( forbiddenName ) ),
      `forbidden supplied tandem name: ${name}. If a tandem is not supplied, its name should not be used to create a supplied tandem.` );

    this.children = {};

    if ( this.parentTandem ) {
      assert && assert( !this.parentTandem.hasChild( name ), `parent should not have child: ${name}` );
      this.parentTandem.addChild( name, this );
    }

    this.required = options.required;
    this.supplied = options.supplied;

  }

  // Get the regex to test for a valid tandem name, given the char class for your specific tandem. In the regex
  // language. In this function we will wrap it in `[]+` brackets forming the actual "class".
  protected static getRegexFromCharacterClass( tandemCharacterClass: string = TandemConstants.BASE_TANDEM_CHARACTER_CLASS ): RegExp {
    return new RegExp( `^[${tandemCharacterClass}]+$` );
  }

  /**
   * If the provided tandem is not supplied, support the ?printMissingTandems query parameter for extra logging during
   * initial instrumentation.
   */
  public static onMissingTandem( tandem: Tandem ): void {

    // When the query parameter phetioPrintMissingTandems is true, report tandems that are required but not supplied
    if ( PRINT_MISSING_TANDEMS && !tandem.supplied ) {

      const stackTrace = Tandem.captureStackTrace();

      if ( tandem.required ) {
        missingTandems.required.push( { phetioID: tandem.phetioID, stack: stackTrace } );
      }
      else {

        // When the query parameter phetioPrintMissingTandems is true, report tandems that are optional but not
        // supplied, but not for Fonts because they are too numerous.
        if ( !stackTrace.includes( 'Font' ) ) {
          missingTandems.optional.push( { phetioID: tandem.phetioID, stack: stackTrace } );
        }
      }
    }
  }

  /**
   * Get a stack trace from a new instance of an Error(). This also uses window.Error.stackTraceLimit to expand the
   * length of the stack trace. This can be useful in spots where the stack is the only information we have about
   * where we are in common code (like for knowing where to provide a Tandem  for PhET-iO instrumentation).
   * @param limit - set to Error.stackTraceLimit just for a single stack trace, then return to the previous value after.
   */
  private static captureStackTrace( limit = Infinity ): string {

    // Check if Error.stackTraceLimit exists and is writable
    const descriptor = Object.getOwnPropertyDescriptor( Error, 'stackTraceLimit' );
    const stackTraceWritable = descriptor && ( descriptor.writable || ( descriptor.set && typeof descriptor.set === 'function' ) );

    if ( stackTraceWritable ) {

      // Save the original stackTraceLimit before changing it
      // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
      // @ts-ignore
      const originalStackTraceLimit = Error.stackTraceLimit;

      // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
      // @ts-ignore
      Error.stackTraceLimit = limit;
      const stackTrace = new Error().stack!;

      // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
      // @ts-ignore
      Error.stackTraceLimit = originalStackTraceLimit;
      return stackTrace;
    }
    else {
      return new Error().stack!;
    }
  }

  /**
   * Adds a PhetioObject.  For example, it could be an axon Property, SCENERY/Node or SUN/RoundPushButton.
   * phetioEngine listens for when PhetioObjects are added and removed to keep track of them for PhET-iO.
   */
  public addPhetioObject( phetioObject: PhetioObject ): void {

    if ( PHET_IO_ENABLED ) {

      // Throw an error if the tandem is required but not supplied
      assert && Tandem.VALIDATION && assert( !( this.required && !this.supplied ), 'Tandem was required but not supplied' );

      // If tandem is optional and not supplied, then ignore it.
      if ( !this.required && !this.supplied ) {

        // Optionally instrumented types without tandems are not added.
        return;
      }

      if ( !Tandem.launched ) {
        Tandem.bufferedPhetioObjects.push( phetioObject );
      }
      else {
        for ( let i = 0; i < phetioObjectListeners.length; i++ ) {
          phetioObjectListeners[ i ].addPhetioObject( phetioObject );
        }
      }
    }
  }

  /**
   * Returns true if this Tandem has the specified ancestor Tandem.
   */
  public hasAncestor( ancestor: Tandem ): boolean {
    return this.parentTandem === ancestor || !!( this.parentTandem && this.parentTandem.hasAncestor( ancestor ) );
  }

  /**
   * Removes a PhetioObject and signifies to listeners that it has been removed.
   */
  public removePhetioObject( phetioObject: PhetioObject ): void {

    // No need to handle this case for uninstrumented objects being removed
    if ( !this.supplied ) {
      return;
    }

    // Only active when running as phet-io
    if ( PHET_IO_ENABLED ) {
      if ( !Tandem.launched ) {
        assert && assert( Tandem.bufferedPhetioObjects.includes( phetioObject ), 'should contain item' );
        arrayRemove( Tandem.bufferedPhetioObjects, phetioObject );
      }
      else {
        for ( let i = 0; i < phetioObjectListeners.length; i++ ) {
          phetioObjectListeners[ i ].removePhetioObject( phetioObject );
        }
      }
    }

    phetioObject.tandem.dispose();
  }

  /**
   * Used for creating new tandems, extends this Tandem's options with the passed-in options.
   */
  public getExtendedOptions( options?: TandemOptions ): TandemOptions {

    // Any child of something should be passed all inherited options. Make sure that this extend call includes all
    // that make sense from the constructor's extend call.
    return merge( {
      supplied: this.supplied,
      required: this.required
    }, options );
  }

  /**
   * Create a new Tandem by appending the given id, or if the child Tandem already exists, return it instead.
   */
  public createTandem( name: string, options?: TandemOptions ): Tandem {
    assert && Tandem.VALIDATION && assert( !UNALLOWED_TANDEM_NAMES.includes( name ), 'tandem name is not allowed: ' + name );

    options = this.getExtendedOptions( options );

    // re-use the child if it already exists, but make sure it behaves the same.
    if ( this.hasChild( name ) ) {
      const currentChild = this.children[ name ];
      assert && assert( currentChild.required === options.required );
      assert && assert( currentChild.supplied === options.supplied );
      return currentChild;
    }
    else {
      return new Tandem( this, name, options ); // eslint-disable-line phet/bad-sim-text
    }
  }

  /**
   * Create a new Tandem by indexing with the specified index.  Note that it increments by 1 so that index 0 is
   * "1" in the tandem name.
   * For example:
   * - createTandem( 'foo', 0 ) => 'foo1'
   */
  public createTandem1Indexed( name: string, index: number, options?: TandemOptions ): Tandem {
    return this.createTandem( `${name}${index + 1}`, options );
  }

  public hasChild( name: string ): boolean {
    return this.children.hasOwnProperty( name );
  }

  public addChild( name: string, tandem: Tandem ): void {
    assert && assert( !this.hasChild( name ) );
    this.children[ name ] = tandem;
  }

  /**
   * Fire a callback on all descendants of this Tandem
   */
  public iterateDescendants( callback: ( t: Tandem ) => void ): void {
    for ( const childName in this.children ) {
      if ( this.children.hasOwnProperty( childName ) ) {
        callback( this.children[ childName ] );
        this.children[ childName ].iterateDescendants( callback );
      }
    }
  }

  private removeChild( childName: string ): void {
    assert && assert( this.hasChild( childName ) );
    delete this.children[ childName ];
  }

  private dispose(): void {
    assert && assert( !this.isDisposed, 'already disposed' );

    this.parentTandem!.removeChild( this.name );
    this.parentTandem = null;

    this.isDisposed = true;
  }

  /**
   * For API validation, each PhetioObject has a corresponding archetype PhetioObject for comparison. Non-dynamic
   * PhetioObjects have the trivial case where its archetypal phetioID is the same as its phetioID.
   */
  public getArchetypalPhetioID(): PhetioID {
    return PhetioIDUtils.getArchetypalPhetioID( this.phetioID );
  }

  /**
   * Creates a group tandem for creating multiple indexed child tandems, such as:
   * sim.screen.model.electron0
   * sim.screen.model.electron1
   *
   * In this case, 'sim.screen.model.electron' is the string passed to createGroupTandem.
   *
   * Used for arrays, observable arrays, or when many elements of the same type are created and they do not otherwise
   * have unique identifiers.
   *
   * Typically, the initialIndex is 1, but we have left the option to keep as zero for legacy simulations that were
   * designed before this convention.
   */
  public createGroupTandem( name: string, initialIndex = 1 ): GroupTandem {
    if ( this.children[ name ] ) {
      return this.children[ name ] as GroupTandem;
    }
    return new GroupTandem( this, name, initialIndex );
  }

  public equals( tandem: Tandem ): boolean {
    return this.phetioID === tandem.phetioID;
  }

  /**
   * Adds a listener that will be notified when items are registered/deregistered
   */
  public static addPhetioObjectListener( phetioObjectListener: PhetioObjectListener ): void {
    phetioObjectListeners.push( phetioObjectListener );
  }

  /**
   * After all listeners have been added, then Tandem can be launched.  This registers all of the buffered PhetioObjects
   * and subsequent PhetioObjects will be registered directly.
   */
  public static launch(): void {
    assert && assert( !Tandem.launched, 'Tandem cannot be launched twice' );
    Tandem.launched = true;

    while ( launchListeners.length > 0 ) {
      launchListeners.shift()!();
    }
    assert && assert( launchListeners.length === 0 );
  }

  /**
   * ONLY FOR TESTING!!!!
   * This was created to "undo" launch so that tests can better expose cases around calling Tandem.launch()
   */
  public static unlaunch(): void {
    Tandem.launched = false;
    Tandem.bufferedPhetioObjects.length = 0;
    launchListeners.length = 0;
  }

  /**
   * Add a listener that will fire when Tandem is launched
   */
  public static addLaunchListener( listener: () => void ): void {
    assert && assert( !Tandem.launched, 'tandem has already been launched, cannot add listener for that hook.' );
    launchListeners.push( listener );
  }

  /**
   * Expose collected missing tandems only populated from specific query parameter, see phetioPrintMissingTandems
   * (phet-io internal)
   */
  public static readonly missingTandems = missingTandems;

  /**
   * If PhET-iO is enabled in this runtime.
   */
  public static readonly PHET_IO_ENABLED = PHET_IO_ENABLED;

  /**
   * If PhET-iO is running with validation enabled.
   */
  public static readonly VALIDATION = VALIDATION;

  /**
   * If phetioAPIValidation is enabled, this is mostly just readonly, except some internal logic for phet-io startup and qunit testing
   */
  public static apiValidationEnabled = assertEnabled && Tandem.VALIDATION;

  /**
   * For the API file, the key name for the metadata section.
   */
  public static readonly METADATA_KEY = '_metadata';

  /**
   * For the API file, the key name for the data section.
   */
  public static readonly DATA_KEY = '_data';

  // Before listeners are wired up, tandems are buffered.  When listeners are wired up, Tandem.launch() is called and
  // buffered tandems are flushed, then subsequent tandems are delivered to listeners directly
  public static launched = false;

  // a list of PhetioObjects ready to be sent out to listeners, but can't because Tandem hasn't been launched yet.
  public static readonly bufferedPhetioObjects: PhetioObject[] = [];

  public createTandemFromPhetioID( phetioID: PhetioID ): Tandem {
    return this.createTandem( phetioID.split( PhetioIDUtils.SEPARATOR ).join( INTER_TERM_SEPARATOR ), {
      isValidTandemName: ( name: string ) => Tandem.getRegexFromCharacterClass( TandemConstants.BASE_DERIVED_TANDEM_CHARACTER_CLASS ).test( name )
    } );
  }

  private static readonly RootTandem = class RootTandem extends Tandem {

    /**
     * RootTandems only accept specifically named children.
     */
    public override createTandem( name: string, options?: TandemOptions ): Tandem {
      if ( Tandem.VALIDATION ) {
        const allowedOnRoot = name === PhetioIDUtils.GLOBAL_COMPONENT_NAME ||
                              name === REQUIRED_TANDEM_NAME ||
                              name === OPTIONAL_TANDEM_NAME ||
                              name === TEST_TANDEM_NAME ||
                              name === PhetioIDUtils.GENERAL_COMPONENT_NAME ||
                              _.endsWith( name, Tandem.SCREEN_TANDEM_NAME_SUFFIX );
        assert && assert( allowedOnRoot, `tandem name not allowed on root: "${name}"; perhaps try putting it under general or global` );
      }

      return super.createTandem( name, options );
    }
  };

  /**
   * The root tandem for a simulation
   */
  public static readonly ROOT: Tandem = new Tandem.RootTandem( null, _.camelCase( packageJSON.name ) );

  /**
   * Many simulation elements are nested under "general". This tandem is for elements that exists in all sims. For a
   * place to put simulation specific globals, see `GLOBAL`
   *
   * @constant
   * @type {Tandem}
   */
  private static readonly GENERAL = Tandem.ROOT.createTandem( PhetioIDUtils.GENERAL_COMPONENT_NAME );

  /**
   * Used in unit tests
   */
  public static readonly ROOT_TEST = Tandem.ROOT.createTandem( TEST_TANDEM_NAME );

  /**
   * Tandem for model simulation elements that are general to all sims.
   */
  public static readonly GENERAL_MODEL = Tandem.GENERAL.createTandem( PhetioIDUtils.MODEL_COMPONENT_NAME );

  /**
   * Tandem for view simulation elements that are general to all sims.
   */
  public static readonly GENERAL_VIEW = Tandem.GENERAL.createTandem( PhetioIDUtils.VIEW_COMPONENT_NAME );

  /**
   * Tandem for controller simulation elements that are general to all sims.
   */
  public static readonly GENERAL_CONTROLLER = Tandem.GENERAL.createTandem( PhetioIDUtils.CONTROLLER_COMPONENT_NAME );

  /**
   * Simulation elements that don't belong in screens should be nested under "global". Note that this tandem should only
   * have simulation specific elements in them. Instrument items used by all sims under `Tandem.GENERAL`. Most
   * likely simulations elements should not be directly under this, but instead either under the model or view sub
   * tandems.
   *
   * @constant
   * @type {Tandem}
   */
  private static readonly GLOBAL = Tandem.ROOT.createTandem( PhetioIDUtils.GLOBAL_COMPONENT_NAME );

  /**
   * Model simulation elements that don't belong in specific screens should be nested under this Tandem. Note that this
   * tandem should only have simulation specific elements in them.
   */
  public static readonly GLOBAL_MODEL = Tandem.GLOBAL.createTandem( PhetioIDUtils.MODEL_COMPONENT_NAME );

  /**
   * View simulation elements that don't belong in specific screens should be nested under this Tandem. Note that this
   * tandem should only have simulation specific elements in them.
   */
  public static readonly GLOBAL_VIEW = Tandem.GLOBAL.createTandem( PhetioIDUtils.VIEW_COMPONENT_NAME );

  /**
   * Colors used in the simulation.
   */
  public static readonly COLORS = Tandem.GLOBAL_VIEW.createTandem( PhetioIDUtils.COLORS_COMPONENT_NAME );

  /**
   * Colors used in the simulation.
   */

  public static readonly STRINGS = Tandem.GENERAL_MODEL.createTandem( PhetioIDUtils.STRINGS_COMPONENT_NAME );

  /**
   * Get the Tandem location for model strings. Provide the camelCased repo name for where the string should be
   * organized. This will default to the sim's name. See https://github.com/phetsims/tandem/issues/298
   */
  public static getStringsTandem( moduleName: string = Tandem.ROOT.name ): Tandem {
    return Tandem.STRINGS.createTandem( moduleName );
  }

  /**
   * Get the Tandem location for derived model strings. Provide the camelCased repo name for where the string should be
   * organized. This will default to the sim's name. See https://github.com/phetsims/tandem/issues/298
   */
  public static getDerivedStringsTandem( moduleName: string = Tandem.ROOT.name ): Tandem {
    return Tandem.getStringsTandem( moduleName ).createTandem( 'derivedStrings' );
  }

  /**
   * In TypeScript, optionize already knows that `tandem` may be undefined, just use `options.tandem?` See https://github.com/phetsims/tandem/issues/289
   * Used to indicate a common code component that supports tandem, but doesn't require it.  If a tandem is not
   * passed in, then it will not be instrumented.
   */
  public static readonly OPTIONAL = Tandem.ROOT.createTandem( OPTIONAL_TANDEM_NAME, {
    required: false,
    supplied: false
  } );

  /**
   * To be used exclusively to opt out of situations where a tandem is required, see https://github.com/phetsims/tandem/issues/97.
   */
  public static readonly OPT_OUT = Tandem.OPTIONAL;

  /**
   * Some common code (such as Checkbox or RadioButton) must always be instrumented.
   */
  public static readonly REQUIRED = Tandem.ROOT.createTandem( REQUIRED_TANDEM_NAME, {

    // let phetioPrintMissingTandems bypass this
    required: VALIDATION || PRINT_MISSING_TANDEMS,
    supplied: false
  } );

  /**
   * Use this as the parent tandem for Properties that are related to sim-specific preferences.
   */
  public static readonly PREFERENCES = Tandem.GLOBAL_MODEL.createTandem( 'preferences' );
}

Tandem.addLaunchListener( () => {
  while ( Tandem.bufferedPhetioObjects.length > 0 ) {
    const phetioObject = Tandem.bufferedPhetioObjects.shift();
    phetioObject!.tandem.addPhetioObject( phetioObject! );
  }
  assert && assert( Tandem.bufferedPhetioObjects.length === 0, 'bufferedPhetioObjects should be empty' );
} );

/**
 * Group Tandem -- Declared in the same file to avoid circular reference errors in module loading.
 */
class GroupTandem extends Tandem {

  /**
   * create with Tandem.createGroupTandem
   */
  public constructor( parentTandem: Tandem,
                      private readonly groupName: string,
                      private groupMemberIndex: number // for generating indices from a pool
  ) {
    super( parentTandem, groupName );
  }

  /**
   * Creates the next tandem in the group.
   */
  public createNextTandem(): Tandem {
    const tandem = this.parentTandem!.createTandem( `${this.groupName}${this.groupMemberIndex}` );
    this.groupMemberIndex++;
    return tandem;
  }
}

tandemNamespace.register( 'Tandem', Tandem );
export default Tandem;