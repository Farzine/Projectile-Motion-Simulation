// Copyright 2019-2025, University of Colorado Boulder

/**
 * Supertype for containers that hold dynamic elements that are PhET-iO instrumented. This type handles common
 * features like creating the archetype for the PhET-iO API, and managing created/disposed data stream events.
 *
 * "Dynamic" is an overloaded term, so allow me to explain what it means in the context of this type. A "dynamic element"
 * is an instrumented PhET-iO Element that is conditionally in the PhET-iO API. Most commonly this is because elements
 * can be created and destroyed during the runtime of the sim. Another "dynamic element" for the PhET-iO project is when
 * an element may or may not be created based on a query parameter. In this case, even if the object then exists for the
 * lifetime of the sim, we may still call this "dynamic" as it pertains to this type, and the PhET-iO API.
 *
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import Emitter from '../../axon/js/Emitter.js';
import TEmitter from '../../axon/js/TEmitter.js';
import validate from '../../axon/js/validate.js';
import arrayRemove from '../../phet-core/js/arrayRemove.js';
import merge from '../../phet-core/js/merge.js';
import optionize from '../../phet-core/js/optionize.js';
import IntentionalAny from '../../phet-core/js/types/IntentionalAny.js';
import PickRequired from '../../phet-core/js/types/PickRequired.js';
import StrictOmit from '../../phet-core/js/types/StrictOmit.js';
import DynamicTandem from './DynamicTandem.js';
import isClearingPhetioDynamicElementsProperty from './isClearingPhetioDynamicElementsProperty.js';
import isSettingPhetioStateProperty from './isSettingPhetioStateProperty.js';
import { PhetioElementMetadata, PhetioState } from './phet-io-types.js';
import PhetioIDUtils from './PhetioIDUtils.js';
import PhetioObject, { PhetioObjectMetadataInput, PhetioObjectOptions } from './PhetioObject.js';
import Tandem, { DYNAMIC_ARCHETYPE_NAME } from './Tandem.js';
import tandemNamespace from './tandemNamespace.js';
import { AnyIOType } from './types/IOType.js';
import StringIO from './types/StringIO.js';

export type ClearOptions = {
  phetioState?: PhetioState | null;
};

// constants
const DEFAULT_CONTAINER_SUFFIX = 'Container';

type SelfOptions = {

  // By default, a PhetioDynamicElementContainer's elements are included in state such that on every setState call,
  // the elements are cleared out by the phetioStateEngine so elements in the state can be added to the empty group.
  // This option is for opting out of that behavior. When false, this container will not have its elements cleared
  // when beginning to set PhET-iO state. Furthermore, view elements following the "only the models are stateful"
  // pattern must mark this as false, otherwise the state engine will try to create these elements instead of letting
  // the model notifications handle this.
  supportsDynamicState?: boolean;

  // The container's tandem name must have this suffix, and the base tandem name for elements in
  // the container will consist of the group's tandem name with this suffix stripped off.
  containerSuffix?: string;

  // tandem name for elements in the container is the container's tandem name without containerSuffix
  phetioDynamicElementName?: string;
};

export type PhetioDynamicElementContainerOptions =
  SelfOptions
  & StrictOmit<PhetioObjectOptions, 'phetioDynamicElement'>
  & PickRequired<PhetioObjectOptions, 'phetioType'>;

function archetypeCast<T>( archetype: T | null ): T {
  if ( archetype === null ) {
    throw new Error( 'archetype should exist' );
  }
  return archetype;
}

abstract class PhetioDynamicElementContainer<T extends PhetioObject, CreateElementArguments extends IntentionalAny[] = []> extends PhetioObject {
  private readonly _archetype: T | null;
  public readonly elementCreatedEmitter: TEmitter<[ T, string ]>;
  public readonly elementDisposedEmitter: TEmitter<[ T, string ]>;
  private notificationsDeferred: boolean;
  private readonly deferredCreations: T[];
  private readonly deferredDisposals: T[];
  public readonly supportsDynamicState: boolean; // (phet-io internal)
  protected phetioDynamicElementName: string;
  protected createElement: ( t: Tandem, ...args: CreateElementArguments ) => T;

  // Arguments passed to the archetype when creating it.
  protected defaultArguments: CreateElementArguments | ( () => CreateElementArguments );

  /**
   * @param createElement - function that creates a dynamic readonly element to be housed in
   * this container. All of this dynamic element container's elements will be created from this function, including the
   * archetype.
   * @param defaultArguments - arguments passed to createElement when creating the archetype
   * @param [providedOptions] - describe the Group itself
   */
  public constructor( createElement: ( t: Tandem, ...args: CreateElementArguments ) => T, defaultArguments: CreateElementArguments | ( () => CreateElementArguments ), providedOptions?: PhetioDynamicElementContainerOptions ) {

    const options = optionize<PhetioDynamicElementContainerOptions, SelfOptions, PhetioObjectOptions>()( {
      phetioState: false, // elements are included in state, but the container will exist in the downstream sim.

      // Many PhET-iO instrumented types live in common code used by multiple sims, and may only be instrumented in a subset of their usages.
      supportsDynamicState: true,
      containerSuffix: DEFAULT_CONTAINER_SUFFIX,

      // TODO: https://github.com/phetsims/tandem/issues/254
      // @ts-expect-error - this is filled in below
      phetioDynamicElementName: undefined
    }, providedOptions );

    assert && assert( Array.isArray( defaultArguments ) || typeof defaultArguments === 'function', 'defaultArguments should be an array or a function' );
    if ( Array.isArray( defaultArguments ) ) {

      // createElement expects a Tandem as the first arg
      assert && assert( createElement.length === defaultArguments.length + 1, 'mismatched number of arguments' );
    }

    assert && Tandem.VALIDATION && assert( !!options.phetioType, 'phetioType must be supplied' );
    assert && Tandem.VALIDATION && assert( Array.isArray( options.phetioType.parameterTypes ),
      'phetioType must supply its parameter types' );
    assert && Tandem.VALIDATION && assert( options.phetioType.parameterTypes!.length === 1,
      'PhetioDynamicElementContainer\'s phetioType must have exactly one parameter type' );
    assert && Tandem.VALIDATION && assert( !!options.phetioType.parameterTypes![ 0 ],
      'PhetioDynamicElementContainer\'s phetioType\'s parameterType must be truthy' );
    if ( assert && options.tandem?.supplied ) {
      assert && Tandem.VALIDATION && assert( options.tandem.name.endsWith( options.containerSuffix ),
        'PhetioDynamicElementContainer tandems should end with options.containerSuffix' );
    }

    // options that depend on other options for their default
    if ( options.tandem && !options.phetioDynamicElementName ) {
      options.phetioDynamicElementName = options.tandem.name.slice( 0, options.tandem.name.length - options.containerSuffix.length );
    }

    super( options );

    this.supportsDynamicState = options.supportsDynamicState;
    this.phetioDynamicElementName = options.phetioDynamicElementName;

    this.createElement = createElement;
    this.defaultArguments = defaultArguments;

    // Can be used as an argument to create other archetypes, but otherwise
    // access should not be needed. This will only be non-null when generating the PhET-iO API, see createArchetype().
    this._archetype = this.createArchetype();

    // subtypes expected to fire this according to individual implementations
    this.elementCreatedEmitter = new Emitter<[ T, string ]>( {
      parameters: [
        { valueType: PhetioObject, phetioType: options.phetioType.parameterTypes![ 0 ], name: 'element' },
        { name: 'phetioID', phetioType: StringIO }
      ],
      tandem: options.tandem.createTandem( 'elementCreatedEmitter' ),
      phetioDocumentation: 'Emitter that fires whenever a new dynamic element is added to the container.'
    } );

    // called on disposal of an element
    this.elementDisposedEmitter = new Emitter<[ T, string ]>( {
      parameters: [
        { valueType: PhetioObject, phetioType: options.phetioType.parameterTypes![ 0 ], name: 'element' },
        { name: 'phetioID', phetioType: StringIO }
      ],
      tandem: options.tandem.createTandem( 'elementDisposedEmitter' ),
      phetioDocumentation: 'Emitter that fires whenever a dynamic element is removed from the container.'
    } );

    // Emit to the data stream on element creation/disposal, no need to do this in PhET brand
    if ( Tandem.PHET_IO_ENABLED && this.isPhetioInstrumented() ) {
      this.elementCreatedEmitter.addListener( element => this.createdEventListener( element ) );
      this.elementDisposedEmitter.addListener( element => this.disposedEventListener( element ) );
    }

    // a way to delay creation notifications to a later time, for phet-io state engine support
    this.notificationsDeferred = false;

    // lists to keep track of the created and disposed elements when notifications are deferred.
    // These are used to then flush notifications when they are set to no longer be deferred.
    this.deferredCreations = [];
    this.deferredDisposals = [];

    // provide a way to opt out of containers clearing dynamic state, useful if group elements exist for the lifetime of
    // the sim, see https://github.com/phetsims/tandem/issues/132
    if ( Tandem.PHET_IO_ENABLED && this.supportsDynamicState &&

         // don't clear archetypes because they are static.
         !this.phetioIsArchetype && this.isPhetioInstrumented() ) {

      assert && assert( _.hasIn( window, 'phet.phetio.phetioEngine.phetioStateEngine' ),
        'PhetioDynamicElementContainers must be created once phetioEngine has been constructed' );

      const phetioStateEngine = phet.phetio.phetioEngine.phetioStateEngine;

      // On state start, clear out the container and set to defer notifications.
      phetioStateEngine.clearDynamicElementsEmitter.addListener( ( state: PhetioState, scopeTandem: Tandem ) => {

        // Only clear if this PhetioDynamicElementContainer is in scope of the state to be set
        if ( this.tandem.hasAncestor( scopeTandem ) ) {
          this.clear( {
            phetioState: state
          } );
          this.setNotificationsDeferred( true );
        }
      } );

      // done with state setting
      phetioStateEngine.undeferEmitter.addListener( () => {
        if ( this.notificationsDeferred ) {
          this.setNotificationsDeferred( false );
        }
      } );

      phetioStateEngine.addSetStateHelper( ( state: PhetioState, stillToSetIDs: string[] ) => {
        let creationNotified = false;

        let iterationCount = 0;

        while ( this.deferredCreations.length > 0 ) {

          if ( iterationCount > 200 ) {
            throw new Error( 'Too many iterations in deferred creations, stillToSetIDs = ' + stillToSetIDs.join( ', ' ) );
          }

          const deferredCreatedElement = this.deferredCreations[ 0 ];
          if ( this.stateSetOnAllChildrenOfDynamicElement( deferredCreatedElement.tandem.phetioID, stillToSetIDs ) ) {
            this.notifyElementCreatedWhileDeferred( deferredCreatedElement );
            creationNotified = true;
          }

          iterationCount++;
        }
        return creationNotified;
      } );
    }
  }

  /**
   * @returns true if all children of a single dynamic element (based on phetioID) have had their state set already.
   */
  private stateSetOnAllChildrenOfDynamicElement( dynamicElementID: string, stillToSetIDs: string[] ): boolean {
    for ( let i = 0; i < stillToSetIDs.length; i++ ) {

      if ( PhetioIDUtils.isAncestor( dynamicElementID, stillToSetIDs[ i ] ) ) {
        return false;
      }
    }
    return true; // No elements in state that aren't in the completed list
  }

  /**
   * Archetypes are created to generate the baseline file, or to validate against an existing baseline file.  They are
   * PhetioObjects and registered with the phetioEngine, but not send out via notifications from PhetioEngine.phetioElementAddedEmitter(),
   * because they are intended for internal usage only.  Archetypes should not be created in production code.
   *
   * PhetioDynamicElementContainer calls this method internally to create and assign its own archetype, but this method
   * can additionally be called with alternate archetypeTandem and/or createElementArgs to create alternate archetypes.
   * This can be necessary in situations that require archetypes provided to other archetypes, or with other forms
   * of dependency injection, such as in https://github.com/phetsims/tandem/issues/312
   */
  public createArchetype(
    archetypeTandem = this.tandem.createTandem( DYNAMIC_ARCHETYPE_NAME ),
    createElementArgs: ( CreateElementArguments | ( () => CreateElementArguments ) ) = this.defaultArguments
  ): T | null {

    // Once the sim has started, any archetypes being created are likely done so because they are nested PhetioGroups.
    if ( _.hasIn( window, 'phet.joist.sim' ) && phet.joist.sim.isConstructionCompleteProperty.value ) {
      assert && assert( false, 'nested DynamicElementContainers are not currently supported' );
      return null;
    }

    // When generating the baseline, output the schema for the archetype
    if ( Tandem.PHET_IO_ENABLED && phet.preloads.phetio.createArchetypes ) {
      const archetypeArgs = Array.isArray( createElementArgs ) ? createElementArgs : createElementArgs();

      // The create function takes a tandem plus the default args
      assert && assert( this.createElement.length === archetypeArgs.length + 1, 'mismatched number of arguments' );

      const archetype = this.createElement( archetypeTandem, ...archetypeArgs );

      // Mark the archetype for inclusion in the baseline schema
      if ( this.isPhetioInstrumented() ) {
        archetype.markDynamicElementArchetype();
      }
      return archetype;
    }
    else {
      return null;
    }
  }

  /**
   * Create a dynamic PhetioObject element for this container
   * @param componentName
   * @param argsForCreateFunction
   * @param containerParameterType - null in PhET brand
   */
  public createDynamicElement( componentName: string, argsForCreateFunction: CreateElementArguments, containerParameterType: AnyIOType | null ): T {
    assert && assert( Array.isArray( argsForCreateFunction ), 'should be array' );

    // create with default state and substructure, details will need to be set by setter methods.

    let createdObjectTandem;
    if ( !this.tandem.hasChild( componentName ) ) {
      createdObjectTandem = new DynamicTandem( this.tandem, componentName, this.tandem.getExtendedOptions() );
    }
    else {
      createdObjectTandem = this.tandem.createTandem( componentName, this.tandem.getExtendedOptions() );
      assert && assert( createdObjectTandem instanceof DynamicTandem, 'createdObjectTandem should be an instance of DynamicTandem' ); // eslint-disable-line phet/no-simple-type-checking-assertions
    }

    const createdObject = this.createElement( createdObjectTandem, ...argsForCreateFunction );

    // This validation is only needed for PhET-iO brand
    if ( Tandem.PHET_IO_ENABLED && this.isPhetioInstrumented() ) {
      assert && assert( containerParameterType !== null, 'containerParameterType must be provided in PhET-iO brand' );

      // Make sure the new group element matches the schema for elements.
      validate( createdObject, containerParameterType!.validator );

      assert && assert( createdObject.phetioType.extends( containerParameterType! ),
        'dynamic element container expected its created instance\'s phetioType to match its parameterType.' );
    }

    assert && this.assertDynamicPhetioObject( createdObject );

    return createdObject;
  }

  /**
   * A dynamic element should be an instrumented PhetioObject with phetioDynamicElement: true
   */
  private assertDynamicPhetioObject( phetioObject: T ): void {
    if ( Tandem.PHET_IO_ENABLED && Tandem.VALIDATION ) {
      assert && assert( phetioObject.isPhetioInstrumented(), 'instance should be instrumented' );
      assert && assert( phetioObject.phetioDynamicElement, 'instance should be marked as phetioDynamicElement:true' );
    }
  }

  /**
   * Emit a created or disposed event.
   */
  private emitDataStreamEvent( dynamicElement: T, eventName: string, additionalData?: Record<string, unknown> | null ): void {
    this.phetioStartEvent( eventName, {
      data: merge( {
        phetioID: dynamicElement.tandem.phetioID
      }, additionalData )
    } );
    this.phetioEndEvent();
  }

  /**
   * Emit events when dynamic elements are created.
   */
  private createdEventListener( dynamicElement: T ): void {
    const additionalData = dynamicElement.phetioState ? {

      state: this.phetioType.parameterTypes![ 0 ].toStateObject( dynamicElement )
    } : null;
    this.emitDataStreamEvent( dynamicElement, 'created', additionalData );
  }

  /**
   * Emit events when dynamic elements are disposed.
   */
  private disposedEventListener( dynamicElement: T ): void {
    this.emitDataStreamEvent( dynamicElement, 'disposed' );
  }

  public override dispose(): void {

    // If hitting this assertion because of nested dynamic element containers, please discuss with a phet-io team member.
    assert && assert( false, 'PhetioDynamicElementContainers are not intended for disposal' );
  }

  /**
   * Dispose a contained element
   */
  protected disposeElement( element: T ): void {
    element.dispose();

    assert && this.supportsDynamicState && _.hasIn( window, 'phet.joist.sim' ) && assert(
      // We do not want to be disposing dynamic elements when state setting EXCEPT when we are clearing all dynamic
      // elements (which is ok and expected to do at the beginning of setting state).
      !( isSettingPhetioStateProperty.value && !isClearingPhetioDynamicElementsProperty ),
      'should not dispose a dynamic element while setting phet-io state' );

    if ( this.notificationsDeferred ) {
      this.deferredDisposals.push( element );
    }
    else {
      this.elementDisposedEmitter.emit( element, element.tandem.phetioID );
    }
  }

  /**
   * Called when clearing the contents of this container to ready things for setting its state. In general, this class
   * is set up to destroy and then recreate all of its elements instead of mutating them.
   */
  public abstract clear( clearOptions?: ClearOptions ): void;

  /**
   * Flush a single element from the list of deferred disposals that have not yet notified about the disposal. This
   * should never be called publicly, instead see `disposeElement`
   */
  private notifyElementDisposedWhileDeferred( disposedElement: T ): void {
    assert && assert( this.notificationsDeferred, 'should only be called when notifications are deferred' );
    assert && assert( this.deferredDisposals.includes( disposedElement ), 'disposedElement should not have been already notified' );
    this.elementDisposedEmitter.emit( disposedElement, disposedElement.tandem.phetioID );
    arrayRemove( this.deferredDisposals, disposedElement );
  }

  /**
   * Should be called by subtypes upon element creation, see PhetioGroup as an example.
   */
  protected notifyElementCreated( createdElement: T ): void {
    if ( this.notificationsDeferred ) {
      this.deferredCreations.push( createdElement );
    }
    else {
      this.elementCreatedEmitter.emit( createdElement, createdElement.tandem.phetioID );
    }
  }

  /**
   * Flush a single element from the list of deferred creations that have not yet notified about the disposal. This
   * is only public to support specific order dependencies in the PhetioStateEngine, otherwise see `this.notifyElementCreated()`
   * (PhetioGroupTests, phet-io) - only the PhetioStateEngine should notify individual elements created.
   */
  public notifyElementCreatedWhileDeferred( createdElement: T ): void {
    assert && assert( this.notificationsDeferred, 'should only be called when notifications are deferred' );
    assert && assert( this.deferredCreations.includes( createdElement ), 'createdElement should not have been already notified' );
    this.elementCreatedEmitter.emit( createdElement, createdElement.tandem.phetioID );
    arrayRemove( this.deferredCreations, createdElement );
  }

  /**
   * When set to true, creation and disposal notifications will be deferred until set to false. When set to false,
   * this function will flush all the notifications for created and disposed elements (in that order) that occurred
   * while this container was deferring its notifications.
   */
  public setNotificationsDeferred( notificationsDeferred: boolean ): void {
    assert && assert( notificationsDeferred !== this.notificationsDeferred, 'should not be the same as current value' );

    // Flush all notifications when setting to be no longer deferred
    if ( !notificationsDeferred ) {
      while ( this.deferredCreations.length > 0 ) {
        this.notifyElementCreatedWhileDeferred( this.deferredCreations[ 0 ] );
      }
      while ( this.deferredDisposals.length > 0 ) {
        this.notifyElementDisposedWhileDeferred( this.deferredDisposals[ 0 ] );
      }
    }
    assert && assert( this.deferredCreations.length === 0, 'creations should be clear' );
    assert && assert( this.deferredDisposals.length === 0, 'disposals should be clear' );
    this.notificationsDeferred = notificationsDeferred;
  }

  /**
   * @throws error if trying to access when archetypes aren't being created.
   */
  public get archetype(): T {
    return archetypeCast( this._archetype );
  }

  /**
   * Add the phetioDynamicElementName for API tracking
   */
  public override getMetadata( object: PhetioObjectMetadataInput ): PhetioElementMetadata {
    const metadata = super.getMetadata( object );
    assert && assert(
      !metadata.hasOwnProperty( 'phetioDynamicElementName' ),
      'PhetioDynamicElementContainer sets the phetioDynamicElementName metadata key'
    );
    return merge( { phetioDynamicElementName: this.phetioDynamicElementName }, metadata );
  }
}

tandemNamespace.register( 'PhetioDynamicElementContainer', PhetioDynamicElementContainer );
export default PhetioDynamicElementContainer;