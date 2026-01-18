/**
 * @file AIEnhancementsCard.tsx
 * @description UI component for configuring AI enhancements using MAXIM models.
 */
import { useTranslation } from 'react-i18next';
import { useProcessingContext } from '../context/ProcessingContext';
import { MAXIM_TASKS } from '../constants/aiConstants';
import '../styles/ColorCorrectionCard.css'; // reusing card styles for consistency

/**
 * AIEnhancementsCard component.
 * @component
 * @returns {JSX.Element} The rendered AI enhancements card.
 */
const AIEnhancementsCard = () => {
    const { t } = useTranslation();
    const {
        processingOptions,
        handleAIEnhancementToggle,
        handleAIEnhancementReorder
    } = useProcessingContext();

    const { tasks } = processingOptions.aiEnhancements || { tasks: [] };

    // Get all available tasks
    const availableTasks = Object.values(MAXIM_TASKS);

    // Selected tasks (ordered)
    const selectedTasks = tasks || [];

    // Unselected tasks (unordered/default order)
    const unselectedTasks = availableTasks.filter(task => !(selectedTasks as string[]).includes(task));

    // Drag and Drop handlers
    const handleDragStart = (e: React.DragEvent, index: number) => {
        e.dataTransfer.setData('text/plain', index.toString());
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

        const newTasks = [...selectedTasks];
        const [movedTask] = newTasks.splice(sourceIndex, 1);
        newTasks.splice(targetIndex, 0, movedTask);

        handleAIEnhancementReorder(newTasks);
    };

    const getTaskLabel = (task: string) => {
        return t(`ai.${task}`, task.charAt(0).toUpperCase() + task.slice(1).replace('-', ' '));
    };

    return (
        <div className="card ai-enhancements-card">
            <h3 className="card-title">
                <i className="fas fa-wand-magic-sparkles"></i> {t('ai.enhancementsTitle', 'AI Enhancements')}
            </h3>

            <div className="mt-md px-sm">
                <p className="text-sm text-gray-400 mb-sm">
                    {t('ai.instruction', 'Click to toggle. Drag selected items to reorder processing steps.')}
                </p>

                {/* Selected Tasks (Draggable) */}
                {selectedTasks.length > 0 && (
                    <div className="space-y-xs mb-xs">
                        {selectedTasks.map((task, index) => (
                            <div
                                key={task}
                                draggable
                                onDragStart={(e) => handleDragStart(e, index)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, index)}
                                className="flex items-center justify-between w-full bg-primary/20 border border-primary p-sm rounded cursor-move hover:bg-primary/30 transition-colors"
                            >
                                <div className="flex items-center">
                                    <span className="text-accent font-mono mr-sm">{index + 1}.</span>
                                    <span className="font-medium text-white">{getTaskLabel(task)}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleAIEnhancementToggle(task)}
                                    className="text-gray-400 hover:text-white transition-colors"
                                    title={t('common.remove')}
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Unselected Tasks */}
                {unselectedTasks.length > 0 && (
                    <div className="space-y-xs">
                        {unselectedTasks.map(task => (
                            <button
                                key={task}
                                type="button"
                                onClick={() => handleAIEnhancementToggle(task)}
                                className="flex items-center justify-start w-full p-sm rounded bg-gray-700 hover:bg-gray-600 transition-colors text-left text-sm text-gray-300"
                            >
                                <i className="fas fa-plus mr-sm text-gray-500"></i>
                                {getTaskLabel(task)}
                            </button>
                        ))}
                    </div>
                )}

                {selectedTasks.length === 0 && unselectedTasks.length === 0 && (
                    <div className="text-gray-500 text-sm italic">{t('ai.noTasksAvailable', 'No enhancements available')}</div>
                )}
            </div>
        </div>
    );
};

export default AIEnhancementsCard;
