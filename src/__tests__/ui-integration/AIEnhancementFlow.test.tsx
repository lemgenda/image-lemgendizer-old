import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProcessingProvider } from '../../context/ProcessingContext';
import AIEnhancementsCard from '../../components/AIEnhancementsCard';

// Mock the AI Enhancements Processor
vi.mock('../../processors', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        enhanceImageWithMaxim: vi.fn(),
        loadAIModel: vi.fn(),
        preloadUpscalerModel: vi.fn()
    };
});

// Mock aiWorkerUtils
vi.mock('../../utils/aiWorkerUtils', () => ({
    enhanceInWorker: vi.fn(),
    showProcessingToast: vi.fn(),
    warmupAIModels: vi.fn()
}));

// Mock utils
vi.mock('../../utils', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        createImageObjects: vi.fn(),
        loadUTIFLibrary: vi.fn()
    };
});

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultVal?: string) => {
            if (key === 'ai.enhancementsTitle') return 'AI Enhancements';
            if (key === 'common.enable') return 'Enable';
            if (key === 'common.disable') return 'Disable';
            if (key === 'ai.instruction') return 'Click to toggle. Drag selected items to reorder processing steps.';
            if (key === 'ai.enhancement') return 'Enhancement';
            if (key === 'ai.deblurring') return 'Deblurring';
            if (key === 'ai.activeTasks') return 'Active Pipeline';
            if (key === 'ai.availableTasks') return 'Available Enhancements';
            if (key === 'common.remove') return 'Remove';
            if (defaultVal) return defaultVal;
            return key;
        },
        i18n: { changeLanguage: vi.fn() }
    })
}));

describe('AIEnhancementsCard Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the AI Enhancements card with available tasks', () => {
        render(
            <ProcessingProvider>
                <AIEnhancementsCard />
            </ProcessingProvider>
        );

        expect(screen.getByText('AI Enhancements')).toBeInTheDocument();
        expect(screen.getByText(/Click to toggle/)).toBeInTheDocument();
        // Since default state is no tasks selected, should show available tasks
        expect(screen.getByText('Enhancement')).toBeInTheDocument();
    });

    it('adds and removes tasks via buttons', async () => {
        render(
            <ProcessingProvider>
                <AIEnhancementsCard />
            </ProcessingProvider>
        );

        // Initially "Enhancement" is in available list (button)
        const addBtn = screen.getByText('Enhancement');
        // It should NOT have a remove button yet
        expect(screen.queryByTitle('Remove')).not.toBeInTheDocument();

        // Add task
        await userEvent.click(addBtn);

        // "Enhancement" should now have a "Remove" button
        await waitFor(() => {
            expect(screen.getByTitle('Remove')).toBeInTheDocument();
        });

        const removeBtn = screen.getByTitle('Remove');
        expect(removeBtn).toBeInTheDocument();

        // Remove task
        await userEvent.click(removeBtn);

        // Remove button should disappear
        await waitFor(() => {
            expect(screen.queryByTitle('Remove')).not.toBeInTheDocument();
        });
    });

    it('reorders active tasks via drag and drop', async () => {
        render(
            <ProcessingProvider>
                <AIEnhancementsCard />
            </ProcessingProvider>
        );

        // Add two tasks
        const enhancementBtn = screen.getByText('Enhancement');
        await userEvent.click(enhancementBtn);

        // mocked in previous step
        const deblurringBtn = screen.getByText('Deblurring');
        await userEvent.click(deblurringBtn);

        // Verify both are present and draggable (selected items are draggable)
        const activeItems = screen.getAllByText(/^Enhancement$|^Deblurring$/);
        // Note: the items themselves might be inside the draggable div, so we check closest
        const draggableDivs = activeItems.map(el => el.closest('[draggable="true"]'));
        expect(draggableDivs).toHaveLength(2);
        expect(draggableDivs[0]).toBeInTheDocument();

        // Get draggable items
        const draggableItems = screen.getAllByText(/^Enhancement$|^Deblurring$/).map(el => el.closest('[draggable="true"]'));
        expect(draggableItems).toHaveLength(2);

        const [firstItem, secondItem] = draggableItems;
        expect(firstItem).toHaveTextContent('Enhancement'); // Added first
        expect(secondItem).toHaveTextContent('Deblurring'); // Added second

        if (firstItem && secondItem) {
            // Mock dataTransfer
            const dataTransfer = {
                setData: vi.fn(),
                getData: vi.fn(() => '0'), // Moving index 0
                effectAllowed: 'move',
                dropEffect: 'move'
            };

            const { fireEvent, createEvent } = await import('@testing-library/react');

            const dragStartEvent = createEvent.dragStart(firstItem);
            Object.defineProperty(dragStartEvent, 'dataTransfer', { value: dataTransfer });
            fireEvent(firstItem, dragStartEvent);

            const dragOverEvent = createEvent.dragOver(secondItem);
            Object.defineProperty(dragOverEvent, 'dataTransfer', { value: dataTransfer });
            fireEvent(secondItem, dragOverEvent);

            const dropEvent = createEvent.drop(secondItem);
            Object.defineProperty(dropEvent, 'dataTransfer', { value: dataTransfer });
            fireEvent(secondItem, dropEvent);

            // Wait for re-render and check order swap
            await waitFor(() => {
                const newDraggableItems = screen.getAllByText(/^Enhancement$|^Deblurring$/).map(el => el.closest('[draggable="true"]'));
                expect(newDraggableItems[0]).toHaveTextContent('Deblurring');
                expect(newDraggableItems[1]).toHaveTextContent('Enhancement');
            });
        }
    });
});
