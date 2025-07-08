// Copyright 2019-2025, University of Colorado Boulder

/**
 * Provides a placeholder in the static API for where dynamic elements may be created.  Checks that elements of the group
 * match the approved schema.
 *
 * In general when creating an element, any extra wiring or listeners should not be added. These side effects are a code
 * smell in the `createElement` parameter. Instead attach a listener for when elements are created, and wire up listeners
 * there. Further documentation about using PhetioGroup can be found at
 * https://github.com/phetsims/phet-io/blob/main/doc/phet-io-instrumentation-technical-guide.md#dynamically-created-phet-io-elements
 *
 * @author Michael Kauzmann (PhET Interactive Simulations)
 * @author Sam Reid (PhET Interactive Simulations)
 * @author Chris Klusendorf (PhET Interactive Simulations)
 */

import NumberProperty from '../../axon/js/NumberProperty.js';
import arrayRemove from '../../phet-core/js/arrayRemove.js';
import optionize from '../../phet-core/js/optionize.js';
import IntentionalAny from '../../phet-core/js/types/IntentionalAny.js';
import IOTypeCache from './IOTypeCache.js';
import isSettingPhetioStateProperty from './isSettingPhetioStateProperty.js';
import PhetioDynamicElementContainer, { ClearOptions, PhetioDynamicElementContainerOptions } from './PhetioDynamicElementContainer.js';
import PhetioIDUtils from './PhetioIDUtils.js';
import PhetioObject from './PhetioObject.js';
import phetioStateSetEmitter from './phetioStateSetEmitter.js';
import Tandem from './Tandem.js';
import tandemNamespace from './tandemNamespace.js';
import IOType, { AnyIOType } from './types/IOType.js';

// constants
const DEFAULT_CONTAINER_SUFFIX = 'Group';

type PhetioGroupClearOptions = {
  resetIndex?: boolean;
} & ClearOptions;

type SelfOptions = {

  // What the tandem name index count should start at, default to 0
  groupElementStartingIndex?: number;
};
export type PhetioGroupOptions = SelfOptions & PhetioDynamicElementContainerOptions;

// cache each parameterized IOType so that it is only created once.
const cache = new IOTypeCache();

class PhetioGroup<T extends PhetioObject, P extends IntentionalAny[] = []> extends PhetioDynamicElementContainer<T, P> {
  private readonly _array: T[];

  // (only for PhetioGroupIO) - for generating indices from a pool
  private groupElementIndex: number;
  private groupElementStartingIndex: number;
  public readonly countProperty: NumberProperty; // (read-only)

  /**
   * @param createElement - function that creates a dynamic element to be housed in
   * this container. All of this dynamic element container's elements will be created from this function, including the
   * archetype.
   * @param defaultArguments - arguments passed to createElement when creating the archetype.
   *                                       Note: if `createElement` supports options, but don't need options for this
   *                                       defaults array, you should pass an empty object here anyways.
   * @param [providedOptions] - describe the Group itself
   */
  public constructor( createElement: ( t: Tandem, ...p: P ) => T, defaultArguments: P | ( () => P ), providedOptions?: PhetioGroupOptions ) {

    const options = optionize<PhetioGroupOptions, SelfOptions, PhetioDynamicElementContainerOptions>()( {
      groupElementStartingIndex: 1,

      // {string} The group's tandem name must have this suffix, and the base tandem name for elements of
      // the group will consist of the group's tandem name with this suffix stripped off.
      containerSuffix: DEFAULT_CONTAINER_SUFFIX
    }, providedOptions );

    super( createElement, defaultArguments, options );

    // (PhetioGroupTests only) access using getArray or getArrayCopy
    this._array = [];


    this.groupElementStartingIndex = options.groupElementStartingIndex;
    this.groupElementIndex = this.groupElementStartingIndex;

    this.countProperty = new NumberProperty( 0, {
      tandem: options.tandem?.createTandem( 'countProperty' ),
      phetioDocumentation: 'the number of elements in the group',
      phetioReadOnly: true,
      phetioFeatured: true,
      numberType: 'Integer'
    } );

    assert && this.countProperty.link( count => {
      if ( assert && !isSettingPhetioStateProperty.value ) {
        assert && assert( count === this._array.length, `${this.countProperty.tandem.phetioID} listener fired and array length differs, count=${count}, arrayLength=${this._array.length}` );
      }
    } );

    // countProperty can be overwritten during state set, see PhetioGroup.createIndexedElement(), and so this assertion
    // makes sure that the final length of the elements array matches the expected count from the state.
    assert && Tandem.VALIDATION && phetioStateSetEmitter.addListener( ( state: Record<string, IntentionalAny> ) => {

      // This supports cases when only partial state is being set
      if ( state[ this.countProperty.tandem.phetioID ] ) {
        assert && assert( state[ this.countProperty.tandem.phetioID ].value === this._array.length, `${this.countProperty.tandem.phetioID} should match array length.  Expected ${state[ this.countProperty.tandem.phetioID ].value} but found ${this._array.length}` );
      }
    } );
  }

  /**
   */
  public override dispose(): void {
    assert && assert( false, 'PhetioGroup not intended for disposal' );
  }

  /**
   * Remove an element from this Group, unregistering it from PhET-iO and disposing it.
   * The order is guaranteed to be:
   * 1. remove from internal array
   * 2. update countProperty
   * 3. element.dispose
   * 4. fire elementDisposedEmitter
   *
   * @param element
   */
  public override disposeElement( element: T ): void {
    assert && assert( !element.isDisposed, 'element already disposed' );
    arrayRemove( this._array, element );

    this.countProperty.value = this._array.length;

    super.disposeElement( element );
  }

  /**
   * Gets a reference to the underlying array. DO NOT create/dispose elements while iterating, or otherwise modify
   * the array.  If you need to modify the array, use getArrayCopy.
   */
  public getArray(): T[] {
    return this._array;
  }

  /**
   * Gets a copy of the underlying array. Use this method if you need to create/dispose elements while iterating,
   * or otherwise modify the group's array.
   */
  public getArrayCopy(): T[] {
    return this._array.slice();
  }

  /**
   * Returns the element at the specified index
   */
  public getElement( index: number ): T {
    assert && assert( index >= 0 && index < this.count, 'index out of bounds: ' + index + ', array length is ' + this.count );
    return this._array[ index ];
  }

  public getLastElement(): T {
    return this.getElement( this.count - 1 );
  }

  /**
   * Gets the number of elements in the group.
   */
  public get count(): number { return this.countProperty.value; }

  /**
   * Returns an array with elements that pass the filter predicate.
   */
  public filter( predicate: ( t: T ) => boolean ): T[] { return this._array.filter( predicate ); }

  /**
   * Does the group include the specified element?
   */
  public includes( element: T ): boolean { return this._array.includes( element ); }

  /**
   * Gets the index of the specified element in the underlying array.
   */
  public indexOf( element: T ): number { return this._array.indexOf( element ); }

  /**
   * Runs the function on each element of the group.
   */
  public forEach( action: ( t: T ) => void ): void { this._array.forEach( action ); }

  /**
   * Use the predicate to find the first matching occurrence in the array.
   */
  public find( predicate: ( t: T ) => boolean ): T | undefined { return this._array.find( predicate ); }

  /**
   * Returns an array with every element mapped to a new one.
   */
  public map<U>( f: ( t: T ) => U ): U[] { return this._array.map( f ); }

  /**
   * Remove and dispose all registered group elements
   */
  public override clear( providedOptions?: PhetioGroupClearOptions ): void {
    const options = optionize<PhetioGroupClearOptions>()( {
      phetioState: null, // not supported in PhetioGroup at this time

      // whether the group's index is reset to 0 for the next element created
      resetIndex: true
    }, providedOptions );

    while ( this._array.length > 0 ) {

      // An earlier draft removed elements from the end (First In, Last Out). However, listeners that observe this list
      // often need to run arrayRemove for corresponding elements, which is based on indexOf and causes an O(N^2) behavior
      // by default (since the first removal requires skimming over the entire list). Hence we prefer First In, First
      // Out, so that listeners will have O(n) behavior for removal from associated lists.
      // See https://github.com/phetsims/natural-selection/issues/252
      this.disposeElement( this._array[ 0 ] );
    }

    if ( options.resetIndex ) {
      this.groupElementIndex = this.groupElementStartingIndex;
    }
  }

  /**
   * When creating a view element that corresponds to a specific model element, we match the tandem name index suffix
   * so that electron_0 corresponds to electronNode_0 and so on.
   * @param tandemName - the tandem name of the model element
   * @param argsForCreateFunction - args to be passed to the create function, specified there are in the IOType
   *                                      `stateObjectToCreateElementArguments` method
   */
  public createCorrespondingGroupElement( tandemName: string, ...argsForCreateFunction: P ): T {

    const index = PhetioIDUtils.getGroupElementIndex( tandemName );

    // If the specified index overlapped with the next available index, bump it up so there is no collision on the
    // next createNextElement
    if ( this.groupElementIndex === index ) {
      this.groupElementIndex++;
    }
    return this.createIndexedElement( index, argsForCreateFunction );
  }

  /**
   * Creates the next group element.
   * @param argsForCreateFunction - args to be passed to the create function, specified there are in the IOType
   *                                      `stateObjectToCreateElementArguments` method
   */
  public createNextElement( ...argsForCreateFunction: P ): T {
    return this.createIndexedElement( this.groupElementIndex++, argsForCreateFunction );
  }

  /**
   * Primarily for internal use, clients should usually use createNextElement.
   * The order is guaranteed to be:
   * 1. instantiate element
   * 2. add to internal array
   * 3. update countProperty
   * 4. fire elementCreatedEmitter
   *
   * @param index - the number of the individual element
   * @param argsForCreateFunction
   * @param [fromStateSetting] - Used for validation during state setting.
   * (PhetioGroupIO)
   */
  public createIndexedElement( index: number, argsForCreateFunction: P, fromStateSetting = false ): T {
    assert && Tandem.VALIDATION && assert( this.isPhetioInstrumented(), 'TODO: support uninstrumented PhetioGroups? see https://github.com/phetsims/tandem/issues/184' );

    assert && this.supportsDynamicState && _.hasIn( window, 'phet.joist.sim' ) &&
    assert && isSettingPhetioStateProperty.value && this.isPhetioInstrumented() && assert( fromStateSetting,
      'dynamic elements should only be created by the state engine when setting state.' );

    const componentName = this.phetioDynamicElementName + PhetioIDUtils.GROUP_SEPARATOR + index;

    // Don't access phetioType in PhET brand
    const containerParameterType = Tandem.PHET_IO_ENABLED && this.isPhetioInstrumented() ? this.phetioType.parameterTypes![ 0 ] : null;

    const groupElement = this.createDynamicElement( componentName, argsForCreateFunction, containerParameterType );

    this._array.push( groupElement );

    this.countProperty.value = this._array.length;

    this.notifyElementCreated( groupElement );

    return groupElement;
  }

  /**
   * Parametric IOType constructor.  Given an element type, this function returns a PhetioGroup IOType.
   */
  public static PhetioGroupIO = <ParameterType extends PhetioObject, ParameterStateType extends ParameterStateSelfType, ParameterStateSelfType>(
    parameterType: IOType<ParameterType, ParameterStateType, ParameterStateSelfType> ): AnyIOType => {

    // TODO: https://github.com/phetsims/tandem/issues/254 specify the correct type instead of IntentionalAny
    if ( !cache.has( parameterType ) ) {
      cache.set( parameterType, new IOType<PhetioGroup<ParameterType>, IntentionalAny>( `PhetioGroupIO<${parameterType.typeName}>`, {

        isValidValue: ( v: IntentionalAny ) => {
          return v instanceof PhetioGroup;
        },
        documentation: 'An array that sends notifications when its values have changed.',

        // This is always specified by PhetioGroup, and will never be this value.
        // See documentation in PhetioCapsule
        metadataDefaults: { phetioDynamicElementName: null },
        parameterTypes: [ parameterType ],

        /**
         * Creates an element and adds it to the group
         * @throws CouldNotYetDeserializeError - if it could not yet deserialize
         * (PhetioStateEngine)
         */
        // @ts-expect-error The group is a group, not just a PhetioDynamicElementContainer
        addChildElement( group: PhetioGroup<PhetioObject>, componentName: string, stateObject: ParameterStateType ): PhetioObject {

          // should throw CouldNotYetDeserializeError if it can't be created yet. Likely that would be because another
          // element in the state needs to be created first, so we will try again on the next iteration of the state
          // setting engine.
          const args = parameterType.stateObjectToCreateElementArguments( stateObject );

          const index = PhetioIDUtils.getGroupElementIndex( componentName );

          // @ts-expect-error args is of type P, but we can't really communicate that here
          const groupElement = group.createIndexedElement( index, args, true );

          // Keep the groupElementIndex in sync so that the next index is set appropriately. This covers the case where
          // no elements have been created in the sim, instead they have only been set via state.
          group.groupElementIndex = Math.max( index + 1, group.groupElementIndex );

          return groupElement;
        }
      } ) );
    }

    return cache.get( parameterType )!;
  };
}

tandemNamespace.register( 'PhetioGroup', PhetioGroup );
export default PhetioGroup;