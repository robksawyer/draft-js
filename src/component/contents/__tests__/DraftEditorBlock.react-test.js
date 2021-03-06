/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @emails oncall+ui_infra
 * @format
 */

'use strict';

jest
  .disableAutomock()
  .mock('Style')
  .mock('getElementPosition')
  .mock('getScrollPosition')
  .mock('getViewportDimensions');

const BlockTree = require('BlockTree');
const CharacterMetadata = require('CharacterMetadata');
const ContentBlock = require('ContentBlock');
const ContentState = require('ContentState');
const DraftEditorBlock = require('DraftEditorBlock.react');
const Immutable = require('immutable');
const React = require('React');
const ReactDOM = require('ReactDOM');
const ReactTestUtils = require('ReactTestUtils');
const SampleDraftInlineStyle = require('SampleDraftInlineStyle');
const SelectionState = require('SelectionState');
const Style = require('Style');
const UnicodeBidiDirection = require('UnicodeBidiDirection');

const getElementPosition = require('getElementPosition');
const getScrollPosition = require('getScrollPosition');
const getViewportDimensions = require('getViewportDimensions');
const reactComponentExpect = require('reactComponentExpect');

const {BOLD, NONE, ITALIC} = SampleDraftInlineStyle;

const mockGetDecorations = jest.fn();

class DecoratorSpan extends React.Component {
  render() {
    return <span>{this.props.children}</span>;
  }
}

// Define a class to satisfy typechecks.
class Decorator {
  getDecorations() {
    return mockGetDecorations();
  }
  getComponentForKey() {
    return DecoratorSpan;
  }
  getPropsForKey() {
    return {};
  }
}

const mockLeafRender = jest.fn(() => <span />);
class MockEditorLeaf extends React.Component {
  render() {
    return mockLeafRender();
  }
}
jest.setMock('DraftEditorLeaf.react', MockEditorLeaf);
Style.getScrollParent.mockReturnValue(window);
window.scrollTo = jest.fn();
getElementPosition.mockReturnValue({
  x: 0,
  y: 600,
  width: 500,
  height: 16,
});
getScrollPosition.mockReturnValue({x: 0, y: 0});
getViewportDimensions.mockReturnValue({width: 1200, height: 800});

const DraftEditorLeaf = require('DraftEditorLeaf.react');

const returnEmptyString = () => {
  return '';
};

const getHelloBlock = () => {
  return new ContentBlock({
    key: 'a',
    type: 'unstyled',
    text: 'hello',
    characterList: Immutable.List(Immutable.Repeat(CharacterMetadata.EMPTY, 5)),
  });
};

const getSelection = () => {
  return new SelectionState({
    anchorKey: 'a',
    anchorOffset: 0,
    focusKey: 'a',
    focusOffset: 0,
    isBackward: false,
    hasFocus: true,
  });
};

const getProps = (block, decorator) => {
  return {
    block,
    tree: BlockTree.generate(ContentState.createFromText(''), block, decorator),
    selection: getSelection(),
    decorator: decorator || null,
    forceSelection: false,
    direction: UnicodeBidiDirection.LTR,
    blockStyleFn: returnEmptyString,
    styleSet: NONE,
  };
};

const arePropsEqual = (renderedChild, leafPropSet) => {
  Object.keys(leafPropSet).forEach(key => {
    expect(
      Immutable.is(leafPropSet[key], renderedChild.instance().props[key]),
    ).toMatchSnapshot();
  });
};

const assertLeaves = (renderedBlock, leafProps) => {
  leafProps.forEach((leafPropSet, ii) => {
    const child = renderedBlock.expectRenderedChildAt(ii);
    child.toBeComponentOfType(DraftEditorLeaf);
    arePropsEqual(child, leafPropSet);
  });
};

beforeEach(() => {
  window.scrollTo.mockClear();
  mockGetDecorations.mockClear();
  mockLeafRender.mockClear();
});

test('must render a leaf node', () => {
  const props = getProps(getHelloBlock());
  const block = ReactTestUtils.renderIntoDocument(
    <DraftEditorBlock {...props} />,
  );

  const rendered = reactComponentExpect(block)
    .expectRenderedChild()
    .toBeComponentOfType('div');

  assertLeaves(rendered, [
    {
      text: 'hello',
      offsetKey: 'a-0-0',
      start: 0,
      styleSet: NONE,
      isLast: true,
    },
  ]);
});

test('must render multiple leaf nodes', () => {
  const boldLength = 2;
  let helloBlock = getHelloBlock();
  let characters = helloBlock.getCharacterList();
  characters = characters
    .slice(0, boldLength)
    .map(c => CharacterMetadata.applyStyle(c, 'BOLD'))
    .concat(characters.slice(boldLength));

  helloBlock = helloBlock.set('characterList', characters.toList());

  const props = getProps(helloBlock);
  const block = ReactTestUtils.renderIntoDocument(
    <DraftEditorBlock {...props} />,
  );

  const rendered = reactComponentExpect(block)
    .expectRenderedChild()
    .toBeComponentOfType('div');

  assertLeaves(rendered, [
    {
      text: 'he',
      offsetKey: 'a-0-0',
      start: 0,
      styleSet: BOLD,
      isLast: false,
    },
    {
      text: 'llo',
      offsetKey: 'a-0-1',
      start: 2,
      styleSet: NONE,
      isLast: true,
    },
  ]);
});

test('must allow update when `block` has changed', () => {
  const helloBlock = getHelloBlock();
  const props = getProps(helloBlock);

  const container = document.createElement('div');
  ReactDOM.render(<DraftEditorBlock {...props} />, container);

  expect(mockLeafRender.mock.calls.length).toMatchSnapshot();

  const updatedHelloBlock = helloBlock.set('text', 'hxllo');
  const nextProps = getProps(updatedHelloBlock);

  expect(updatedHelloBlock !== helloBlock).toMatchSnapshot();
  expect(props.block !== nextProps.block).toMatchSnapshot();

  ReactDOM.render(<DraftEditorBlock {...nextProps} />, container);

  expect(mockLeafRender.mock.calls.length).toMatchSnapshot();
});

test('must allow update when `tree` has changed', () => {
  const helloBlock = getHelloBlock();
  const props = getProps(helloBlock);

  const container = document.createElement('div');
  ReactDOM.render(<DraftEditorBlock {...props} />, container);

  expect(mockLeafRender.mock.calls.length).toMatchSnapshot();

  mockGetDecorations.mockReturnValue(
    Immutable.List.of('x', 'x', null, null, null),
  );
  const decorator = new Decorator();

  const newTree = BlockTree.generate(
    ContentState.createFromText(helloBlock.getText()),
    helloBlock,
    decorator,
  );
  const nextProps = {...props, tree: newTree, decorator};

  expect(props.tree !== nextProps.tree).toMatchSnapshot();

  ReactDOM.render(<DraftEditorBlock {...nextProps} />, container);

  expect(mockLeafRender.mock.calls.length).toMatchSnapshot();
});

test('must allow update when `direction` has changed', () => {
  const helloBlock = getHelloBlock();
  const props = getProps(helloBlock);

  const container = document.createElement('div');
  ReactDOM.render(<DraftEditorBlock {...props} />, container);

  expect(mockLeafRender.mock.calls.length).toMatchSnapshot();

  const nextProps = {...props, direction: UnicodeBidiDirection.RTL};
  expect(props.direction !== nextProps.direction).toMatchSnapshot();

  ReactDOM.render(<DraftEditorBlock {...nextProps} />, container);

  expect(mockLeafRender.mock.calls.length).toMatchSnapshot();
});

test('must allow update when forcing selection', () => {
  const helloBlock = getHelloBlock();
  const props = getProps(helloBlock);

  const container = document.createElement('div');
  ReactDOM.render(<DraftEditorBlock {...props} />, container);

  expect(mockLeafRender.mock.calls.length).toMatchSnapshot();

  // The default selection state in this test is on a selection edge.
  const nextProps = {
    ...props,
    forceSelection: true,
  };

  ReactDOM.render(<DraftEditorBlock {...nextProps} />, container);

  expect(mockLeafRender.mock.calls.length).toMatchSnapshot();
});

test('must reject update if conditions are not met', () => {
  const helloBlock = getHelloBlock();
  const props = getProps(helloBlock);

  const container = document.createElement('div');
  ReactDOM.render(<DraftEditorBlock {...props} />, container);

  expect(mockLeafRender.mock.calls.length).toMatchSnapshot();

  // Render again with the exact same props as before.
  ReactDOM.render(<DraftEditorBlock {...props} />, container);

  // No new leaf renders.
  expect(mockLeafRender.mock.calls.length).toMatchSnapshot();
});

test('must reject update if selection is not on an edge', () => {
  const helloBlock = getHelloBlock();
  const props = getProps(helloBlock);

  const container = document.createElement('div');
  ReactDOM.render(<DraftEditorBlock {...props} />, container);

  expect(mockLeafRender.mock.calls.length).toMatchSnapshot();

  // Move selection state to some other block.
  const nonEdgeSelection = props.selection.merge({
    anchorKey: 'z',
    focusKey: 'z',
  });

  const newProps = {...props, selection: nonEdgeSelection};

  // Render again with selection now moved elsewhere and the contents
  // unchanged.
  ReactDOM.render(<DraftEditorBlock {...newProps} />, container);

  // No new leaf renders.
  expect(mockLeafRender.mock.calls.length).toMatchSnapshot();
});

test('must split apart two decorated and undecorated', () => {
  const helloBlock = getHelloBlock();

  mockGetDecorations.mockReturnValue(
    Immutable.List.of('x', 'x', null, null, null),
  );
  const decorator = new Decorator();
  const props = getProps(helloBlock, decorator);

  const container = document.createElement('div');
  const block = ReactDOM.render(<DraftEditorBlock {...props} />, container);

  expect(mockLeafRender.mock.calls.length).toMatchSnapshot();

  const rendered = reactComponentExpect(block)
    .expectRenderedChild()
    .toBeComponentOfType('div');

  rendered
    .expectRenderedChildAt(0)
    .scalarPropsEqual({offsetKey: 'a-0-0'})
    .toBeComponentOfType(DecoratorSpan)
    .expectRenderedChild()
    .toBeComponentOfType('span');

  rendered
    .expectRenderedChildAt(1)
    .scalarPropsEqual({offsetKey: 'a-1-0'})
    .toBeComponentOfType(DraftEditorLeaf);
});

test('must split apart two decorators', () => {
  const helloBlock = getHelloBlock();

  mockGetDecorations.mockReturnValue(
    Immutable.List.of('x', 'x', 'y', 'y', 'y'),
  );

  const decorator = new Decorator();
  const props = getProps(helloBlock, decorator);

  const container = document.createElement('div');
  const block = ReactDOM.render(<DraftEditorBlock {...props} />, container);

  expect(mockLeafRender.mock.calls.length).toMatchSnapshot();

  const rendered = reactComponentExpect(block)
    .expectRenderedChild()
    .toBeComponentOfType('div');

  rendered
    .expectRenderedChildAt(0)
    .scalarPropsEqual({offsetKey: 'a-0-0'})
    .toBeComponentOfType(DecoratorSpan);

  rendered
    .expectRenderedChildAt(1)
    .scalarPropsEqual({offsetKey: 'a-1-0'})
    .toBeComponentOfType(DecoratorSpan);
});

test('must split apart styled spans', () => {
  let helloBlock = getHelloBlock();
  const characters = helloBlock.getCharacterList();
  const newChars = characters
    .slice(0, 2)
    .map(ch => {
      return CharacterMetadata.applyStyle(ch, 'BOLD');
    })
    .concat(characters.slice(2));

  helloBlock = helloBlock.set('characterList', Immutable.List(newChars));
  const props = getProps(helloBlock);

  const container = document.createElement('div');
  const block = ReactDOM.render(<DraftEditorBlock {...props} />, container);

  expect(mockLeafRender.mock.calls.length).toMatchSnapshot();

  const rendered = reactComponentExpect(block)
    .expectRenderedChild()
    .toBeComponentOfType('div');

  let child = rendered.expectRenderedChildAt(0);
  child.toBeComponentOfType(DraftEditorLeaf);
  arePropsEqual(child, {offsetKey: 'a-0-0', styleSet: BOLD});

  child = rendered.expectRenderedChildAt(1);
  child.toBeComponentOfType(DraftEditorLeaf);
  arePropsEqual(child, {offsetKey: 'a-0-1', styleSet: NONE});
});

test('must split styled spans apart within decorator', () => {
  let helloBlock = getHelloBlock();
  const characters = helloBlock.getCharacterList();
  const newChars = Immutable.List([
    CharacterMetadata.applyStyle(characters.get(0), 'BOLD'),
    CharacterMetadata.applyStyle(characters.get(1), 'ITALIC'),
  ]).concat(characters.slice(2));

  helloBlock = helloBlock.set('characterList', Immutable.List(newChars));

  mockGetDecorations.mockReturnValue(
    Immutable.List.of('x', 'x', null, null, null),
  );
  const decorator = new Decorator();
  const props = getProps(helloBlock, decorator);

  const container = document.createElement('div');
  const block = ReactDOM.render(<DraftEditorBlock {...props} />, container);

  expect(mockLeafRender.mock.calls.length).toMatchSnapshot();

  const rendered = reactComponentExpect(block)
    .expectRenderedChild()
    .toBeComponentOfType('div');

  const decoratedSpan = rendered
    .expectRenderedChildAt(0)
    .scalarPropsEqual({offsetKey: 'a-0-0'})
    .toBeComponentOfType(DecoratorSpan)
    .expectRenderedChild();

  let child = decoratedSpan.expectRenderedChildAt(0);
  child.toBeComponentOfType(DraftEditorLeaf);
  arePropsEqual(child, {offsetKey: 'a-0-0', styleSet: BOLD});

  child = decoratedSpan.expectRenderedChildAt(1);
  child.toBeComponentOfType(DraftEditorLeaf);
  arePropsEqual(child, {offsetKey: 'a-0-1', styleSet: ITALIC});

  child = rendered.expectRenderedChildAt(1);
  child.toBeComponentOfType(DraftEditorLeaf);
  arePropsEqual(child, {offsetKey: 'a-1-0', styleSet: NONE});
});

test('must scroll the window if needed', () => {
  const props = getProps(getHelloBlock());

  getElementPosition.mockReturnValueOnce({
    x: 0,
    y: 800,
    width: 500,
    height: 16,
  });

  const container = document.createElement('div');
  ReactDOM.render(<DraftEditorBlock {...props} />, container);

  const scrollCalls = window.scrollTo.mock.calls;
  expect(scrollCalls).toMatchSnapshot();
});

test('must not scroll the window if unnecessary', () => {
  const props = getProps(getHelloBlock());
  const container = document.createElement('div');
  ReactDOM.render(<DraftEditorBlock {...props} />, container);

  const scrollCalls = window.scrollTo.mock.calls;
  expect(scrollCalls).toMatchSnapshot();
});
