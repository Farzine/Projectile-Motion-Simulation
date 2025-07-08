// Copyright 2019-2025, University of Colorado Boulder

/**
 * A PhET-iO class that encapsulates a PhetioObject that is not created during sim startup to provide PhET-iO API
 * validation, API communication (like to view in studio before creation), and to support PhET-iO state if applicable.
 *
 * Constructing a PhetioCapsule creates a container encapsulating a wrapped element that can be of any type.
 *
 * Clients should use myCapsule.getElement() instead of storing the element value itself.
 *
 * NOTE: Be careful about treating the dynamic element as a singleton. When creating the archetype, problems can arise
 * because the capsule creates two instances of the element: one as the archetype and one as the instance. This can
 * result in trouble like in https://github.com/phetsims/joist/issues/821.
 *
 * @author Michael Kauzmann (PhET Interactive Simulations)
 * @author Sam Reid (PhET Interactive Simulations)
 * @author Chris Klusendorf (PhET Interactive Simulations)
 */

import optionize from '../../phet-core/js/optionize.js';
import IntentionalAny from '../../phet-core/js/types/IntentionalAny.js';
import StrictOmit from '../../phet-core/js/types/StrictOmit.js';
import IOTypeCache from './IOTypeCache.js';
import isSettingPhetioStateProperty from './isSettingPhetioStateProperty.js';
import PhetioDynamicElementContainer, { ClearOptions, PhetioDynamicElementContainerOptions } from './PhetioDynamicElementContainer.js';
import PhetioIDUtils from './PhetioIDUtils.js';
import PhetioObject from './PhetioObject.js';
import Tandem from './Tandem.js';
import tandemNamespace from './tandemNamespace.js';
import IOType, { AnyIOType } from './types/IOType.js';

// constants
const DEFAULT_CONTAINER_SUFFIX = PhetioIDUtils.CAPSULE_SUFFIX;

// cache each parameterized IOType so that it is only created once.
const cache = new IOTypeCache();

type SelfOptions = {

  // Some elements like AboutDialog and PreferencesDialog persist for the lifetime of the sim, and once created
  // are never disposed. This allows us to avoid extensive unnecessary work implementing dispose for these elements.
  // If true, dispose the element when cleared. If set to false, clear() will basically be a no-op, which can be
  // useful if you want to support lazy creation, but if this is not a true "dynamic element". This will also cause an
  // assertion if ever trying to call disposeElement on this. https://github.com/phetsims/phet-io/issues/1810
  disposeOnClear?: boolean;

  // Only applicable if disposing during clear. This is an optimization to prevent the need to recreate the element each
  // time PhET-iO state is set. Defaults to false. This should only be true if your dynamic element can be mutated
  // with state, and doesn't need construction to be run during state set. This should be set to true when supporting
  // heterogeneous capsules. https://github.com/phetsims/phet-io/issues/1810
  disposeCreatedOnStateSet?: boolean;
};

// The container suffix has to be "Capsule" or we need to change some logic in PhetioIDUtils.getArchetypalPhetioID
export type PhetioCapsuleOptions = SelfOptions & StrictOmit<PhetioDynamicElementContainerOptions, 'containerSuffix'>;

class PhetioCapsule<T extends PhetioObject, P extends IntentionalAny[] = []> extends PhetioDynamicElementContainer<T, P> {
  private element: T | null;
  private readonly disposeOnClear: boolean;
  private readonly disposeCreatedOnStateSet: boolean;

  /**
   * @param createElement - function that creates the encapsulated element
   * @param defaultArguments - arguments passed to createElement when creating the archetype
   * @param [providedOptions]
   */
  public constructor( createElement: ( t: Tandem, ...p: P ) => T, defaultArguments: P | ( () => P ), providedOptions?: PhetioCapsuleOptions ) {

    const options = optionize<PhetioCapsuleOptions, SelfOptions, PhetioDynamicElementContainerOptions>()( {

      // The capsule's tandem name must have this suffix, and the base tandem name for its wrapped element
      // will consist of the capsule's tandem name with this suffix stripped off.
      containerSuffix: DEFAULT_CONTAINER_SUFFIX,
      disposeOnClear: true,
      disposeCreatedOnStateSet: false
    }, providedOptions );

    super( createElement, defaultArguments, options );

    this.element = null;
    this.disposeOnClear = options.disposeOnClear;
    this.disposeCreatedOnStateSet = options.disposeCreatedOnStateSet;
  }

  /**
   * Dispose the underlying element.  Called by the PhetioStateEngine so the capsule element can be recreated with the
   * correct state.
   */
  public override disposeElement(): void {
    assert && assert( this.element, 'cannot dispose if element is not defined' );
    assert && assert( this.disposeOnClear, 'cannot dispose if element is not disposable' );
    super.disposeElement( this.element! );
    this.element = null;
  }

  public hasElement(): boolean {
    return this.element !== null;
  }

  /**
   * Creates the element if it has not been created yet, and returns it.
   */
  public getElement( ...argsForCreateFunction: P ): T {
    if ( !this.element ) {
      this.create( argsForCreateFunction );
    }
    assert && assert( this.element !== null );
    return this.element!;
  }

  /**
   * PhetioCapsule will dispose its element, clearing things up and getting ready for setState, unless
   * this.disposeOnClear opts out of this behavior, in which case the element should fully support mutating itself
   * during state setting.
   */
  public override clear( providedOptions?: ClearOptions ): void {

    const options = optionize<ClearOptions>()( {
      phetioState: null
    }, providedOptions );

    if ( this.element && this.disposeOnClear ) {
      const appearsInState = options.phetioState && ( options.phetioState.hasOwnProperty( this.element.phetioID ) ?? false );

      // This option forces disposal on clear, otherwise we don't clear if the element exists in state
      if ( this.disposeCreatedOnStateSet || !appearsInState ) {
        this.disposeElement();
      }
    }
  }

  /**
   * Primarily for internal use, clients should usually use getElement().
   * @param argsForCreateFunction
   * @param [fromStateSetting] - used for validation during state setting, see PhetioDynamicElementContainer.disposeElement() for documentation
   * (phet-io)
   */
  public create( argsForCreateFunction: P, fromStateSetting = false ): T {
    assert && assert( this.isPhetioInstrumented(), 'TODO: support uninstrumented PhetioCapsules? see https://github.com/phetsims/tandem/issues/184' );

    assert && this.supportsDynamicState && _.hasIn( window, 'phet.joist.sim.' ) &&
    isSettingPhetioStateProperty.value && assert( fromStateSetting,
      'dynamic elements should only be created by the state engine when setting state.' );

    // create with default state and substructure, details will need to be set by setter methods.
    this.element = this.createDynamicElement(
      this.phetioDynamicElementName,
      argsForCreateFunction,
      Tandem.PHET_IO_ENABLED ? this.phetioType.parameterTypes![ 0 ] : null // Don't access phetioType in PhET brand
    );

    this.notifyElementCreated( this.element );

    return this.element;
  }

  /**
   * Parametric IOType constructor.  Given an element type, this function returns a PhetioCapsule IOType.
   * This caching implementation should be kept in sync with the other parametric IOType caching implementations.
   * @param parameterType
   * @constructor
   */
  public static PhetioCapsuleIO = <ParameterType extends PhetioObject, ParameterStateType>(
    parameterType: IOType<ParameterType, ParameterStateType> ): AnyIOType => {

    if ( !cache.has( parameterType ) ) {
      cache.set( parameterType, new IOType<PhetioCapsule<ParameterType>, IntentionalAny>( `PhetioCapsuleIO<${parameterType.typeName}>`, {
        valueType: PhetioCapsule,
        documentation: 'An array that sends notifications when its values have changed.',
        parameterTypes: [ parameterType ],

        // This is always specified by PhetioCapsule, and will never be this value. Yes, it is odd to have a default value
        // that can never be the actual value, but we thought it would be simplest to reuse the "options" pipeline
        // rather than inventing a new "required" pipeline.
        metadataDefaults: { phetioDynamicElementName: null },

        // @ts-expect-error The group is a group, not just a PhetioDynamicElementContainer
        addChildElement( capsule: PhetioCapsule<ParameterType>, componentName: string, stateObject: ParameterStateType ) {

          // should throw CouldNotYetDeserializeError if it can't be created yet. Likely that would be because another
          // element in the state needs to be created first, so we will try again on the next iteration of the state
          // setting engine.
          const args = parameterType.stateObjectToCreateElementArguments( stateObject );

          // @ts-expect-error args is of type P, but we can't really communicate that here
          return capsule.create( args, true );
        }
      } ) );
    }

    return cache.get( parameterType )!;
  };
}


tandemNamespace.register( 'PhetioCapsule', PhetioCapsule );
export default PhetioCapsule;