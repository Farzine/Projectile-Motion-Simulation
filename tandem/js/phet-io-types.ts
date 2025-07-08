// Copyright 2021-2025, University of Colorado Boulder

/**
 * General TypeScript types that apply to PhET-iO features and architecture.
 *
 * @author Michael Kauzmann (PhET Interactive Simulations)
 * @author Sam Reid (PhET Interactive Simulations)
 */

import IntentionalAny from '../../phet-core/js/types/IntentionalAny.js';

export type PhetioID = string;

export type IOTypeName = string;

export type PhetioElementData = {
  initialState: PhetioElementState;
};

export type PhetioElement = {
  _metadata: PhetioElementMetadata;
  _data?: PhetioElementData;
};

// In tree structure
export type PhetioElements = {

  // Each string is a component name of a PhetioID
  [ name: string ]: PhetioElements;
} & PhetioElement;

export type Method = {
  returnType: string;
  parameterTypes: string[];
  documentation: string;
  invocableForReadOnlyElements?: boolean;
};

// The "top level" state associated with a phetioID in state. This is NOT and never should be a "substate" or nested.
// value within a top-level state.
export type PhetioElementState = Record<string, IntentionalAny>;

export type PhetioState = Record<PhetioID, PhetioElementState>;
export type FullPhetioState = Record<PhetioID, PhetioElementState | 'DELETED'>;

export type Methods = Record<string, Method>;

export type CompositeStateSchemaAPI = Record<string, IOTypeName>;
export type StateSchemaAPI = string | CompositeStateSchemaAPI;

// The API schema, for the actual class on the sim side see IOType.ts
export type PhetioType = {
  methods: Methods;
  supertype?: string; // no supertype for root of hierarchy
  typeName: IOTypeName;
  documentation?: string;
  events: string[];
  metadataDefaults?: Partial<PhetioElementMetadata>;
  dataDefaults?: Record<string, unknown>;
  methodOrder?: string[];
  stateSchema?: StateSchemaAPI;
  apiStateKeys?: ( keyof CompositeStateSchemaAPI )[];
  parameterTypes?: string[]; // each ioTypeName
};
export type PhetioTypes = Record<IOTypeName, PhetioType>;

export type PhetioOverrides = Record<string, Partial<PhetioElementMetadata>>;

export type PhetioAPIVersion = {
  major: number;
  minor: number;
};

// Abstraction for flattened or treelike PhetioAPI
export type AbstractPhetioAPI = {
  version: PhetioAPIVersion;
  phetioFullAPI?: boolean;
  sim: string;
  phetioTypes: PhetioTypes;
};

// The PhET-iO API json structure as it appears in the api files. This nests PhET-iO Elements like the Studio tree, in
// part to save space in the file.
export type PhetioAPI = AbstractPhetioAPI & { phetioElements: PhetioElements };

// The PhET-iO API as it is easiest to use in code. This takes PhetioAPI type (nested elements) and "expands" (flattens)
// each out so that the keys are phetioIDs.
export type FlattenedAPIPhetioElements = Record<PhetioID, PhetioElement>;

export type PhetioElementMetadata = {

  // Used in PhetioObjectOptions
  // When true, includes the PhET-iO Element in the PhET-iO state (not automatically recursive, must be specified for
  // children explicitly)
  phetioState: boolean;

  // When true, you can only get values from the PhET-iO Element; no setting allowed.
  // This option controls how PhET-iO wrappers can interface with this PhetioObject. Predominately this occurs via
  // public methods defined on this PhetioObject's phetioType, in which some method are not executable when this flag
  // is true. See `ObjectIO.methods` for further documentation, especially regarding `invocableForReadOnlyElements`.
  // NOTE: PhetioObjects with {phetioState: true} AND {phetioReadOnly: true} are restored during via setState.
  phetioReadOnly: boolean;

  // The category of event that this element emits to the PhET-iO Data Stream.
  phetioEventType: string;

  // Useful notes about a PhET-iO Element, shown in the PhET-iO Studio Wrapper. It's an html
  // string, so "<br>" tags are required instead of "\n" characters for proper rendering in Studio. NOTE! You must
  // escape any HTML characters that are not intended to be rendered as HTML, use _.escape().
  phetioDocumentation: string;

  // High frequency events such as mouse moves can be omitted from data stream, see ?phetioEmitHighFrequencyEvents
  // and PhetioClient.launchSimulation option
  // @deprecated - see https://github.com/phetsims/phet-io/issues/1629#issuecomment-608002410
  phetioHighFrequency: boolean; // @deprecated

  // When true, emits events for data streams for playback, see handlePlaybackEvent.js
  // @deprecated
  phetioPlayback: boolean; // @deprecated

  // When true, this is categorized as an important "featured" element in Studio.
  // If this is a featured PhET-iO Element.
  // LinkedElements have no phetioFeatured because they defer to their core element
  phetioFeatured?: boolean;

  // If this element is a "dynamic element" that can be created and destroyed throughout the lifetime of the sim (as opposed to existing forever).
  // indicates that an object may or may not have been created. Applies recursively automatically
  // and should only be set manually on the root dynamic element. Dynamic archetypes will have this overwritten to
  // false even if explicitly provided as true, as archetypes cannot be dynamic.
  phetioDynamicElement: boolean;

  // Marking phetioDesigned: true opts-in to API change detection tooling that can be used to catch inadvertent
  // changes to a designed API.  A phetioDesigned:true PhetioObject (or any of its tandem descendants) will throw
  // assertion errors on CT (or when running with ?phetioCompareAPI) when the following are true:
  // (a) its package.json lists compareDesignedAPIChanges:true in the "phet-io" section
  // (b) the simulation is listed in perennial/data/phet-io-api-stable
  // (c) any of its metadata values deviate from the reference API
  phetioDesigned: boolean;

  // Specific to Metadata

  // The name of the PhET-iO Type
  phetioTypeName: IOTypeName;

  // If this element is an archetype for a dynamic element.
  phetioIsArchetype: boolean;
  // If an applicable dynamic element, this is the phetioID of its archetype.
  phetioArchetypePhetioID?: string | null;

  // Specific to PhetioDynamicElementContainer instance, see that file for doc.
  phetioDynamicElementName?: string | null;
};

export type PhetioElementMetadataValue = PhetioElementMetadata[keyof PhetioElementMetadata];