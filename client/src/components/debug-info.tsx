import { useTranslator } from '@/hooks/use-translator';

export default function DebugInfo() {
  const { currentProject, translationItems, projects } = useTranslator();

  return (
    <div className="fixed bottom-4 right-4 bg-black bg-opacity-80 text-white p-4 rounded-lg text-xs max-w-sm z-50">
      <h4 className="font-bold mb-2">Debug Info</h4>
      <div>Projects: {projects?.length || 0}</div>
      <div>Current Project: {currentProject?.id || 'None'}</div>
      <div>Translation Items: {translationItems?.length || 0}</div>
      {currentProject && (
        <div>Project Name: {currentProject.name}</div>
      )}
      {translationItems?.length > 0 && (
        <div className="mt-2 border-t pt-2">
          <div>First Item:</div>
          <div>Key: {translationItems[0]?.key || 'N/A'}</div>
          <div>Text: {translationItems[0]?.originalText?.substring(0, 20) || 'N/A'}...</div>
        </div>
      )}
    </div>
  );
}