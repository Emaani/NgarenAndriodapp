import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { spacing } from '@/theme';
import { BottomSheet, Button } from '@/ui';
import { TextField, SelectField } from '@/ui/Field';

/** Create / Edit Animal sheet (§6.2). UI only — submit is wired in backend phase. */
export function CreateAnimalSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [breed, setBreed] = useState('');
  const [tag, setTag] = useState('');
  const [etag, setEtag] = useState('');
  const [description, setDescription] = useState('');

  return (
    <BottomSheet visible={visible} onClose={onClose} title="New Animal">
      <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
        <SelectField label="Farm / Location" required placeholder="Select location" />
        <SelectField label="Device" placeholder="Select device (optional)" />
        <TextField label="Breed" required value={breed} onChangeText={setBreed} placeholder="e.g. Hereford" />
        <SelectField label="Date of Birth" required placeholder="Select date" icon="calendar" />
        <SelectField label="Dam ID" placeholder="Search dam..." icon="magnify" />
        <SelectField label="Sire ID" placeholder="Search sire..." icon="magnify" />
        <TextField label="Tag" required value={tag} onChangeText={setTag} placeholder="A-042" />
        <TextField label="eTag" value={etag} onChangeText={setEtag} />
        <TextField label="Description" value={description} onChangeText={setDescription} multiline />
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
        <Button label="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
        <Button label="Save" onPress={onClose} style={{ flex: 1 }} />
      </View>
    </BottomSheet>
  );
}
