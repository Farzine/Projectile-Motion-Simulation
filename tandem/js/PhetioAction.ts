// Copyright 2022-2025, University of Colorado Boulder

/**
 * An instrumented class that wraps a function that does "work" that needs to be interoperable with PhET-iO.
 * PhetioAction supports the following features:
 *
 * 1. Data stream support: The function will be wrapped in an `executed` event and added to the data stream, nesting
 * subsequent events the action's "work" cascades to as child events.
 * 2. Interopererability: PhetioActionIO supports the `execute` method so that PhetioAction instances can be executed
 * from the PhET-iO wrapper.
 * 3. It also has an emitter if you want to listen to when the action is done doing its work, https://github.com/phetsims/phet-io/issues/1543
 *
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import Emitter from '../../axon/js/Emitter.js';
import optionize, { EmptySelfOptions } from '../../phet-core/js/optionize.js';
import IntentionalAny from '../../phet-core/js/types/IntentionalAny.js';
import StrictOmit from '../../phet-core/js/types/StrictOmit.js';
import IOTypeCache from './IOTypeCache.js';
import PhetioDataHandler, { Parameter, PhetioDataHandlerOptions } from './PhetioDataHandler.js';
import PhetioObject from './PhetioObject.js';
import Tandem from './Tandem.js';
import tandemNamespace from './tandemNamespace.js';
import ArrayIO from './types/ArrayIO.js';
import IOType, { AnyIOType } from './types/IOType.js';
import NullableIO from './types/NullableIO.js';
import StringIO from './types/StringIO.js';
import VoidIO from './types/VoidIO.js';


const EMPTY_ARRAY: Parameter[] = [];

// By default, PhetioActions are not stateful
const PHET_IO_STATE_DEFAULT = false;

// undefined and never are not allowed as parameters to PhetioAction
type ActionParameter = Exclude<IntentionalAny, undefined | never>;

export type ActionOptions = StrictOmit<PhetioDataHandlerOptions, 'phetioOuterType'>;

class PhetioAction<T extends ActionParameter[] = []> extends PhetioDataHandler<T> {

  private readonly action: ( ...args: T ) => void;

  // Keep track of it this instance is currently executing its action, see execute() for implementation. This needs to
  // be a stack because reentrant PhetioAction execute calls are supported.
  private isExecutingCount: number;

  // Disposal can potentially occur from the action that is being executed. If this is the case, we still want to emit
  // the executedEmitter upon completion of the action, so defer disposal of the executedEmitter (and
  // disposePhetioAction in general), until the execute() function is complete. This doesn't need to be a stack because
  // we do not allow reentrant PhetioActions (guarded with an assertion in execute()).
  private disposeOnExecuteCompletion: boolean;

  // Called upon disposal of PhetioAction, but if dispose() is called while the action is executing, defer calling this
  // function until the execute() function is complete.
  private disposePhetioAction: () => void;

  // To listen to when the action has completed.
  public readonly executedEmitter: Emitter<T>;

  public static readonly PhetioActionIO = ( parameterTypes: AnyIOType[] ): AnyIOType => {
    const key = parameterTypes.map( getTypeName ).join( ',' );
    if ( !cache.has( key ) ) {
      cache.set( key, new IOType<IntentionalAny, IntentionalAny>( `PhetioActionIO<${parameterTypes.map( getTypeName ).join( ', ' )}>`, {
        valueType: PhetioAction,
        documentation: 'Executes when an event occurs',
        events: [ 'executed' ],
        parameterTypes: parameterTypes,
        metadataDefaults: {
          phetioState: PHET_IO_STATE_DEFAULT
        },
        methods: {
          execute: {
            returnType: VoidIO,
            parameterTypes: parameterTypes,
            implementation: function( this: PhetioAction<unknown[]>, ...values: unknown[] ) {
              this.execute( ...values );
            },
            documentation: 'Executes the function the PhetioAction is wrapping.',
            invocableForReadOnlyElements: false
          },
          getValidationErrors: {
            returnType: ArrayIO( NullableIO( StringIO ) ),
            parameterTypes: parameterTypes,
            implementation: function( this: Emitter<unknown[]>, ...values: unknown[] ) {
              return this.getValidationErrors( ...values );
            },
            documentation: 'Checks to see if the proposed values are valid. Returns an array of length N where each element is an error (string) or null if the value is valid.'
          }
        }
      } ) );
    }
    return cache.get( key )!;
  };

  /**
   * @param action - the function that is called when this PhetioAction occurs
   * @param providedOptions
   */
  public constructor( action: ( ...args: T ) => void, providedOptions?: ActionOptions ) {
    const options = optionize<ActionOptions, EmptySelfOptions, PhetioDataHandlerOptions>()( {

      // We need to define this here in addition to PhetioDataHandler to pass to executedEmitter
      parameters: EMPTY_ARRAY,

      // PhetioDataHandler
      phetioOuterType: PhetioAction.PhetioActionIO,

      // PhetioObject
      phetioState: PHET_IO_STATE_DEFAULT,
      phetioReadOnly: PhetioObject.DEFAULT_OPTIONS.phetioReadOnly,
      phetioHighFrequency: PhetioObject.DEFAULT_OPTIONS.phetioHighFrequency,
      phetioEventType: PhetioObject.DEFAULT_OPTIONS.phetioEventType,
      phetioDocumentation: 'A class that wraps a function, adding API to execute that function and data stream capture.'
    }, providedOptions );

    super( options );

    this.action = action;

    this.isExecutingCount = 0;
    this.disposeOnExecuteCompletion = false;

    this.executedEmitter = new Emitter<T>( {
      parameters: options.parameters,
      tandem: options.tandem?.createTandem( 'executedEmitter' ),
      hasListenerOrderDependencies: options.hasListenerOrderDependencies,
      phetioState: options.phetioState,
      phetioReadOnly: options.phetioReadOnly,
      phetioHighFrequency: options.phetioHighFrequency,
      phetioEventType: options.phetioEventType,
      phetioDocumentation: 'Emitter that emits when this actions work is complete'
    } );

    this.disposePhetioAction = () => {
      this.executedEmitter.dispose();
    };
  }

  /**
   * Invokes the action.
   * @params - expected parameters are based on options.parameters, see constructor
   */
  public execute( ...args: T ): void {
    assert && assert( !this.isDisposed, 'should not be called if disposed' );

    // We delay the disposal of composed entities to handle reentrant cases of disposing ourself.
    assert && assert( !this.executedEmitter.isDisposed, 'self should not be disposed' );

    this.isExecutingCount++;

    assert && super.validateArguments( ...args );

    // Although this is not the idiomatic pattern (since it is guarded in the phetioStartEvent), this function is
    // called so many times that it is worth the optimization for PhET brand.
    Tandem.PHET_IO_ENABLED && this.isPhetioInstrumented() && this.phetioStartEvent( 'executed', {
      data: this.getPhetioData( ...args )
    } );

    this.action.apply( null, args );
    this.executedEmitter.emit( ...args );

    Tandem.PHET_IO_ENABLED && this.isPhetioInstrumented() && this.phetioEndEvent();

    this.isExecutingCount--;

    if ( this.disposeOnExecuteCompletion && this.isExecutingCount === 0 ) {
      this.disposePhetioAction();
      this.disposeOnExecuteCompletion = false;
    }
  }

  /**
   * Note: Be careful about adding disposal logic directly to this function, it is likely preferred to add it to
   * disposePhetioAction instead, see disposeOnExecuteCompletion for details.
   */
  public override dispose(): void {
    if ( this.isExecutingCount > 0 ) {

      // Defer disposing components until executing is completed, see disposeOnExecuteCompletion.
      this.disposeOnExecuteCompletion = true;
    }
    else {
      this.disposePhetioAction();
    }

    // Always dispose the object itself, or PhetioObject will assert out.
    super.dispose();
  }
}

const getTypeName = ( ioType: AnyIOType ) => ioType.typeName;

// cache each parameterized IOType so that it is only created once.
const cache = new IOTypeCache<AnyIOType, string>();

tandemNamespace.register( 'PhetioAction', PhetioAction );
export default PhetioAction;