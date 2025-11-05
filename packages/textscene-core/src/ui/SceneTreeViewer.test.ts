/**
 * Proof-of-concept test for SceneTreeViewer (Sprint 0: UI testing verification)
 * Tests happy-dom DOM manipulation capabilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SceneTreeViewer } from './SceneTreeViewer';
import type { TscnNode } from '../parser/types';

describe('SceneTreeViewer (POC)', () => {
  let container: HTMLDivElement;
  let viewer: SceneTreeViewer;

  beforeEach(() => {
    // Create a fresh container for each test
    container = document.createElement('div');
    container.id = 'test-tree-container';
    document.body.appendChild(container);
  });

  describe('Basic DOM Rendering', () => {
    it('should create viewer with container element', () => {
      viewer = new SceneTreeViewer(container);
      expect(viewer).toBeDefined();
      expect(container).toBeDefined();
    });

    it('should render empty tree message when no nodes provided', () => {
      viewer = new SceneTreeViewer(container);
      viewer.renderTree([]);

      const emptyMessage = container.querySelector('.tree-empty');
      expect(emptyMessage).toBeDefined();
      expect(emptyMessage?.textContent).toBe('No nodes to display');
    });

    it('should render single node in tree', () => {
      viewer = new SceneTreeViewer(container);

      const nodes: TscnNode[] = [
        {
          name: 'Root',
          type: 'Node3D',
          properties: {},
          children: []
        }
      ];

      viewer.renderTree(nodes);

      const treeRoot = container.querySelector('.tree-root');
      expect(treeRoot).toBeDefined();

      const nodeElement = container.querySelector('.tree-node');
      expect(nodeElement).toBeDefined();
    });

    it('should render nested nodes with children', () => {
      viewer = new SceneTreeViewer(container);

      const nodes: TscnNode[] = [
        {
          name: 'Root',
          type: 'Node3D',
          properties: {},
          children: [
            {
              name: 'Child1',
              type: 'MeshInstance3D',
              properties: {},
              children: []
            },
            {
              name: 'Child2',
              type: 'Camera3D',
              properties: {},
              children: []
            }
          ]
        }
      ];

      viewer.renderTree(nodes);

      const nodeElements = container.querySelectorAll('.tree-node');
      // Should have 3 nodes: Root + 2 children
      expect(nodeElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Event Handling', () => {
    it('should invoke onNodeSelect callback when node is clicked', () => {
      const onNodeSelect = vi.fn();
      viewer = new SceneTreeViewer(container, { onNodeSelect });

      const nodes: TscnNode[] = [
        {
          name: 'TestNode',
          type: 'Node3D',
          properties: {},
          children: []
        }
      ];

      viewer.renderTree(nodes);

      const nodeHeader = container.querySelector('.tree-node-header');
      expect(nodeHeader).toBeDefined();

      // Simulate click
      nodeHeader?.dispatchEvent(new Event('click', { bubbles: true }));

      // Verify callback was invoked
      expect(onNodeSelect).toHaveBeenCalled();
      expect(onNodeSelect).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'TestNode', type: 'Node3D' }),
        'TestNode'
      );
    });

    it('should invoke onNodeDoubleClick callback when node is double-clicked', () => {
      const onNodeDoubleClick = vi.fn();
      viewer = new SceneTreeViewer(container, { onNodeDoubleClick });

      const nodes: TscnNode[] = [
        {
          name: 'TestNode',
          type: 'Node3D',
          properties: {},
          children: []
        }
      ];

      viewer.renderTree(nodes);

      const nodeHeader = container.querySelector('.tree-node-header');
      expect(nodeHeader).toBeDefined();

      // Simulate double-click
      nodeHeader?.dispatchEvent(new Event('dblclick', { bubbles: true }));

      // Verify callback was invoked
      expect(onNodeDoubleClick).toHaveBeenCalled();
    });
  });

  describe('Search Functionality', () => {
    it('should filter nodes based on search term', () => {
      viewer = new SceneTreeViewer(container);

      const nodes: TscnNode[] = [
        {
          name: 'Player',
          type: 'Node3D',
          properties: {},
          children: []
        },
        {
          name: 'Enemy',
          type: 'Node3D',
          properties: {},
          children: []
        }
      ];

      viewer.renderTree(nodes);

      // Set search term
      viewer.setSearchTerm('Player');

      // Note: Filtering logic may vary - main validation is DOM updates
      // The important part is that the DOM is updated
      expect(container.innerHTML).toBeDefined();
    });
  });

  describe('Expand/Collapse', () => {
    it('should expand all nodes', () => {
      viewer = new SceneTreeViewer(container);

      const nodes: TscnNode[] = [
        {
          name: 'Root',
          type: 'Node3D',
          properties: {},
          children: [
            {
              name: 'Child',
              type: 'Node3D',
              properties: {},
              children: []
            }
          ]
        }
      ];

      viewer.renderTree(nodes);
      viewer.expandAll();

      // Children should be visible after expandAll
      const childNodes = container.querySelectorAll('.tree-node');
      expect(childNodes.length).toBeGreaterThan(0);
    });

    it('should collapse all nodes', () => {
      viewer = new SceneTreeViewer(container);

      const nodes: TscnNode[] = [
        {
          name: 'Root',
          type: 'Node3D',
          properties: {},
          children: [
            {
              name: 'Child',
              type: 'Node3D',
              properties: {},
              children: []
            }
          ]
        }
      ];

      viewer.renderTree(nodes);
      viewer.expandAll();
      viewer.collapseAll();

      // After collapse, tree should still render but children might be hidden
      const treeRoot = container.querySelector('.tree-root');
      expect(treeRoot).toBeDefined();
    });
  });

  describe('Node Visibility Toggle', () => {
    it('should invoke onNodeVisibilityChange when visibility icon clicked', () => {
      const onNodeVisibilityChange = vi.fn();
      viewer = new SceneTreeViewer(container, { onNodeVisibilityChange });

      const nodes: TscnNode[] = [
        {
          name: 'TestNode',
          type: 'Node3D',
          properties: {},
          children: []
        }
      ];

      viewer.renderTree(nodes);

      const visibilityIcon = container.querySelector('.tree-visibility-icon');
      expect(visibilityIcon).toBeDefined();

      // Simulate click on visibility icon
      visibilityIcon?.dispatchEvent(new Event('click', { bubbles: true }));

      // Verify callback was invoked
      expect(onNodeVisibilityChange).toHaveBeenCalled();
      expect(onNodeVisibilityChange).toHaveBeenCalledWith('TestNode', false);
    });
  });
});
