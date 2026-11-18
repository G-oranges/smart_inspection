import { List, Modal, Skeleton, Tag } from "antd";
import type { MembersModalProps, ResultEntryMember } from "../types";
import { MODAL_WIDTH } from "../../../components/common/modalSizes";

export default function MembersModal({
  open,
  members,
  loading,
  onClose,
}: MembersModalProps) {
  return (
    <Modal
      open={open}
      title="宿舍成员"
      onCancel={onClose}
      footer={null}
      centered
      width={MODAL_WIDTH.sm}
      className="co-modal"
    >
      {loading ? (
        <div className="py-12">
          <Skeleton active />
        </div>
      ) : (
        <div className="ios-inset-grouped m-0 -mx-4 border-none shadow-none">
          <List
            dataSource={members}
            className="divide-y divide-ios-divider"
            renderItem={(item: ResultEntryMember) => (
              <List.Item className="px-6 py-4 flex items-center justify-between border-none">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-ios-blue/10 flex items-center justify-center text-ios-blue font-bold">
                    {item.fullName?.charAt(0)}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-lg">
                      {item.fullName}
                    </span>
                    <span className="text-xs text-ios-gray-label font-medium">
                      {item.studentNo}
                    </span>
                  </div>
                </div>
                <Tag className="rounded-full border-none bg-ios-gray dark:bg-white/10 text-ios-gray-label font-bold px-3">
                  床位 {item.bedNo}
                </Tag>
              </List.Item>
            )}
          />
        </div>
      )}
    </Modal>
  );
}
